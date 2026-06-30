import fs from "node:fs/promises";
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

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (requireSession) {
    if (!config.accessToken || !config.refreshToken) {
      throw new Error("Cloud mode is not logged in. Run: subhub cloud login --email <email> --password <password>");
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

  return { client, config };
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
  const { client } = await getClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function listSubscriptions(filters = {}) {
  const { client } = await getClient();
  let query = client.from("subscriptions").select("*").order("next_charge_date", { ascending: true });

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
  const { client } = await getClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await client
    .from("subscriptions")
    .insert(toDbInsert(parsed, userData.user.id))
    .select("*")
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function updateSubscription(id, patch) {
  const current = await getSubscription(id);
  if (!current) return null;
  const parsed = updateSubscriptionSchema.parse(patch);
  const { client } = await getClient();
  const { data, error } = await client
    .from("subscriptions")
    .update(toDbUpdate(parsed))
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function deleteSubscription(id) {
  const current = await getSubscription(id);
  if (!current) return false;
  const { client } = await getClient();
  const { error } = await client.from("subscriptions").delete().eq("id", current.id);
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
