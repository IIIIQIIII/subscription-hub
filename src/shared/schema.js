import { z } from "zod";

export const cycles = ["weekly", "monthly", "quarterly", "annual"];
export const statuses = ["active", "trial", "paused", "cancelled"];
export const categories = [
  "ai",
  "devtools",
  "design",
  "productivity",
  "cloud",
  "media",
  "finance",
  "other"
];
export const owners = ["me", "agent", "team"];

export const subscriptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plan: z.string().default(""),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().min(3).max(3).default("USD"),
  billingCycle: z.enum(cycles).default("monthly"),
  nextChargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(statuses).default("active"),
  category: z.enum(categories).default("other"),
  owner: z.enum(owners).default("me"),
  paymentMethod: z.string().default(""),
  website: z.string().default(""),
  notes: z.string().default(""),
  usefulness: z.coerce.number().int().min(1).max(5).default(3),
  lastReviewedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const createSubscriptionSchema = subscriptionSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial({
    plan: true,
    currency: true,
    billingCycle: true,
    status: true,
    category: true,
    owner: true,
    paymentMethod: true,
    website: true,
    notes: true,
    usefulness: true
  });

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export function monthlyEquivalent(subscription) {
  const amount = Number(subscription.amount || 0);
  switch (subscription.billingCycle) {
    case "weekly":
      return amount * 52 / 12;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    default:
      return amount;
  }
}

export function annualEquivalent(subscription) {
  return monthlyEquivalent(subscription) * 12;
}

export function daysUntil(dateString, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function summarizeSubscriptions(subscriptions) {
  const activeLike = subscriptions.filter((item) => item.status === "active" || item.status === "trial");
  const totalsByCurrency = Object.values(activeLike.reduce((totals, item) => {
    const currency = item.currency || "USD";
    const monthly = monthlyEquivalent(item);
    if (!totals[currency]) {
      totals[currency] = { currency, monthlyTotal: 0, annualTotal: 0 };
    }
    totals[currency].monthlyTotal += monthly;
    totals[currency].annualTotal += monthly * 12;
    return totals;
  }, {})).sort((a, b) => a.currency.localeCompare(b.currency));
  const dueSoon = activeLike
    .map((item) => ({ ...item, daysUntil: daysUntil(item.nextChargeDate) }))
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const lowValue = activeLike
    .filter((item) => item.usefulness <= 2)
    .sort((a, b) => a.usefulness - b.usefulness);

  return {
    count: subscriptions.length,
    activeCount: activeLike.length,
    monthlyTotal: totalsByCurrency.reduce((sum, item) => sum + item.monthlyTotal, 0),
    annualTotal: totalsByCurrency.reduce((sum, item) => sum + item.annualTotal, 0),
    totalsByCurrency,
    dueSoon,
    lowValue,
    categoryTotals: activeLike.reduce((totals, item) => {
      totals[item.category] = (totals[item.category] || 0) + monthlyEquivalent(item);
      return totals;
    }, {})
  };
}
