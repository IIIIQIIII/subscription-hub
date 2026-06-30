import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSubscriptionSchema,
  subscriptionSchema,
  summarizeSubscriptions,
  updateSubscriptionSchema
} from "../shared/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const defaultDataFile = path.join(projectRoot, "data", "subscriptions.json");

export const dataFile = process.env.SUBHUB_DATA_FILE
  ? path.resolve(process.env.SUBHUB_DATA_FILE)
  : defaultDataFile;

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({ subscriptions: [] }, null, 2));
  }
}

async function readRaw() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw);
  const subscriptions = Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [];
  return {
    subscriptions: subscriptions.map((item) => subscriptionSchema.parse(item))
  };
}

async function writeRaw(data) {
  await ensureDataFile();
  await fs.writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeNewSubscription(input) {
  const now = new Date().toISOString();
  const parsed = createSubscriptionSchema.parse(input);

  return subscriptionSchema.parse({
    id: `sub_${crypto.randomUUID().slice(0, 8)}`,
    plan: "",
    currency: "USD",
    billingCycle: "monthly",
    status: "active",
    category: "other",
    owner: "me",
    paymentMethod: "",
    website: "",
    notes: "",
    usefulness: 3,
    ...parsed,
    createdAt: now,
    updatedAt: now
  });
}

export async function listSubscriptions(filters = {}) {
  const data = await readRaw();
  let items = [...data.subscriptions];

  if (filters.status) {
    items = items.filter((item) => item.status === filters.status);
  }
  if (filters.owner) {
    items = items.filter((item) => item.owner === filters.owner);
  }
  if (filters.category) {
    items = items.filter((item) => item.category === filters.category);
  }

  return items.sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate));
}

export async function getSubscription(id) {
  const data = await readRaw();
  return data.subscriptions.find((item) => item.id === id || item.name.toLowerCase() === id.toLowerCase());
}

export async function createSubscription(input) {
  const data = await readRaw();
  const item = normalizeNewSubscription(input);
  data.subscriptions.push(item);
  await writeRaw(data);
  return item;
}

export async function updateSubscription(id, patch) {
  const data = await readRaw();
  const index = data.subscriptions.findIndex((item) => item.id === id || item.name.toLowerCase() === id.toLowerCase());
  if (index === -1) return null;

  const parsed = updateSubscriptionSchema.parse(patch);
  const updated = subscriptionSchema.parse({
    ...data.subscriptions[index],
    ...parsed,
    updatedAt: new Date().toISOString()
  });

  data.subscriptions[index] = updated;
  await writeRaw(data);
  return updated;
}

export async function deleteSubscription(id) {
  const data = await readRaw();
  const before = data.subscriptions.length;
  data.subscriptions = data.subscriptions.filter(
    (item) => item.id !== id && item.name.toLowerCase() !== id.toLowerCase()
  );
  await writeRaw(data);
  return data.subscriptions.length !== before;
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
