import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fromDbRow, toDbInsert, toDbUpdate } from "../shared/dbMapping.js";
import { createSubscriptionSchema, summarizeSubscriptions, updateSubscriptionSchema } from "../shared/schema.js";

const configDir = path.join(os.homedir(), ".subhub");
const configFile = path.join(configDir, "config.json");

async function readConfig() {
  const envConfig = {
    supabaseUrl: process.env.SUBHUB_SUPABASE_URL,
    supabaseAnonKey: process.env.SUBHUB_SUPABASE_ANON_KEY,
    accessToken: process.env.SUBHUB_SUPABASE_ACCESS_TOKEN,
    refreshToken: process.env.SUBHUB_SUPABASE_REFRESH_TOKEN
  };

  let fileConfig = {};
  try {
    fileConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch {
    fileConfig = {};
  }

  return { ...fileConfig, ...stripEmpty(envConfig) };
}

async function writeConfig(config) {
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function stripEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => Boolean(entry)));
}

async function getClient({ requireSession = true } = {}) {
  const config = await readConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Cloud mode is not configured. Run: subhub cloud configure --url <url> --anon-key <key>");
  }

  const key = config.serviceRoleKey || config.supabaseAnonKey;
  const client = createClient(config.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (config.serviceRoleKey && config.adminUserId) {
    return { client, config, userId: config.adminUserId, adminMode: true };
  }

  if (requireSession) {
    if (!config.accessToken || !config.refreshToken) {
      throw new Error("Cloud mode is not logged in. Run: subhub cloud login --email <email> --password <password>, or run: subhub cloud connect-project --project-ref <ref> --user-email <email>");
    }
    const { data, error } = await client.auth.setSession({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    if (error) throw error;
    if (data.session?.access_token && data.session?.refresh_token) {
      await writeConfig({
        ...config,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: data.session.user
      });
    }
  }

  return { client, config, userId: undefined, adminMode: false };
}

export async function configureCloud({ url, anonKey }) {
  const current = await readConfig();
  const next = {
    ...current,
    supabaseUrl: url || current.supabaseUrl,
    supabaseAnonKey: anonKey || current.supabaseAnonKey
  };
  await writeConfig(next);
  return next;
}

function getApiKeyValue(entry) {
  return entry.api_key || entry.key || entry.value || "";
}

function getApiKeyName(entry) {
  return entry.name || entry.api_key_name || entry.type || "";
}

function getServiceRoleKeyFromSupabaseCli(projectRef) {
  try {
    const raw = execFileSync(
      "npx",
      ["supabase", "projects", "api-keys", "--project-ref", projectRef, "--reveal", "--output", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const keys = JSON.parse(raw);
    const serviceRole = keys.find((entry) => getApiKeyName(entry) === "service_role");
    const secret = serviceRole ? getApiKeyValue(serviceRole) : "";
    if (!secret) throw new Error("service_role key was not returned");
    return secret;
  } catch (error) {
    throw new Error(`Could not read the Supabase service role key. Run "npx supabase login" first. ${error.message}`);
  }
}

async function findUserByEmail(client, email) {
  let page = 1;
  while (page < 20) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((entry) => entry.email === email);
    if (user) return user;
    if (data.users.length < 1000) break;
    page += 1;
  }
  return null;
}

export async function connectProjectCloud({ projectRef, userEmail, url, anonKey, serviceRoleKey }) {
  const current = await readConfig();
  const nextUrl = url || current.supabaseUrl || process.env.SUBHUB_SUPABASE_URL;
  const nextAnonKey = anonKey || current.supabaseAnonKey || process.env.SUBHUB_SUPABASE_ANON_KEY;
  const currentServiceRoleKey = current.projectRef === projectRef ? current.serviceRoleKey : "";
  const nextServiceRoleKey = serviceRoleKey || currentServiceRoleKey || getServiceRoleKeyFromSupabaseCli(projectRef);

  if (!nextUrl || !nextAnonKey) {
    throw new Error("Missing Supabase URL or anon key. Run cloud configure first, or pass --url and --anon-key.");
  }

  const adminClient = createClient(nextUrl, nextServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const user = await findUserByEmail(adminClient, userEmail);
  if (!user) throw new Error(`Supabase user not found: ${userEmail}`);

  const next = {
    ...current,
    supabaseUrl: nextUrl,
    supabaseAnonKey: nextAnonKey,
    projectRef,
    serviceRoleKey: nextServiceRoleKey,
    adminUserEmail: user.email,
    adminUserId: user.id
  };
  await writeConfig(next);
  return { email: user.email, id: user.id, projectRef };
}

export async function loginCloud({ email, password }) {
  const { client, config } = await getClient({ requireSession: false });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await writeConfig({
    ...config,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: data.user
  });
  return data.user;
}

export async function logoutCloud() {
  const config = await readConfig();
  await writeConfig({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey
  });
}

export async function whoamiCloud() {
  const { client, config, adminMode } = await getClient();
  if (adminMode) {
    return {
      id: config.adminUserId,
      email: config.adminUserEmail,
      app_metadata: { provider: "service_role" }
    };
  }
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function listSubscriptions(filters = {}) {
  const { client, userId, adminMode } = await getClient();
  let query = client.from("subscriptions").select("*").order("next_charge_date", { ascending: true });
  if (adminMode) query = query.eq("user_id", userId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.owner) query = query.eq("owner", filters.owner);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(fromDbRow);
}

export async function getSubscription(id) {
  const items = await listSubscriptions();
  return items.find((item) => item.id === id || item.name.toLowerCase() === id.toLowerCase());
}

export async function createSubscription(input) {
  const parsed = createSubscriptionSchema.parse(input);
  const { client, userId, adminMode } = await getClient();
  let targetUserId = userId;
  if (!adminMode) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    targetUserId = userData.user.id;
  }

  const { data, error } = await client
    .from("subscriptions")
    .insert(toDbInsert(parsed, targetUserId))
    .select("*")
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function upsertSubscriptions(items) {
  const { client, userId, adminMode } = await getClient();
  let targetUserId = userId;
  if (!adminMode) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    targetUserId = userData.user.id;
  }

  const rows = items.map((item) => ({
    ...toDbInsert(item, targetUserId),
    id: item.id,
    last_reviewed_at: item.lastReviewedAt || null,
    created_at: item.createdAt,
    updated_at: item.updatedAt
  }));

  const { data, error } = await client
    .from("subscriptions")
    .upsert(rows, { onConflict: "id" })
    .select("*")
    .order("next_charge_date", { ascending: true });
  if (error) throw error;
  return data.map(fromDbRow);
}

export async function updateSubscription(id, patch) {
  const current = await getSubscription(id);
  if (!current) return null;
  const parsed = updateSubscriptionSchema.parse(patch);
  const { client, userId, adminMode } = await getClient();
  let query = client
    .from("subscriptions")
    .update(toDbUpdate(parsed))
    .eq("id", current.id);
  if (adminMode) query = query.eq("user_id", userId);
  const { data, error } = await query
    .select("*")
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function deleteSubscription(id) {
  const current = await getSubscription(id);
  if (!current) return false;
  const { client, userId, adminMode } = await getClient();
  let query = client.from("subscriptions").delete().eq("id", current.id);
  if (adminMode) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) throw error;
  return true;
}

export async function cancelSubscription(id) {
  return updateSubscription(id, {
    status: "cancelled",
    notes: `Cancelled or marked for cancellation on ${new Date().toISOString().slice(0, 10)}.`
  });
}

export async function subscriptionSummary(filters = {}) {
  const items = await listSubscriptions(filters);
  return summarizeSubscriptions(items);
}
