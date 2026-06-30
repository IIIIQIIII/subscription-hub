export function fromDbRow(row) {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan || "",
    amount: Number(row.amount || 0),
    currency: row.currency || "USD",
    billingCycle: row.billing_cycle || "monthly",
    nextChargeDate: row.next_charge_date,
    status: row.status || "active",
    category: row.category || "other",
    owner: row.owner || "me",
    paymentMethod: row.payment_method || "",
    website: row.website || "",
    notes: row.notes || "",
    usefulness: Number(row.usefulness || 3),
    lastReviewedAt: row.last_reviewed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toDbInsert(input, userId) {
  return stripUndefined({
    user_id: userId,
    name: input.name,
    plan: input.plan || "",
    amount: Number(input.amount),
    currency: input.currency || "USD",
    billing_cycle: input.billingCycle || input.cycle || "monthly",
    next_charge_date: input.nextChargeDate || input.next,
    status: input.status || "active",
    category: input.category || "other",
    owner: input.owner || "me",
    payment_method: input.paymentMethod || input.payment || "",
    website: input.website || input.url || "",
    notes: input.notes || "",
    usefulness: Number(input.usefulness || input.value || 3)
  });
}

export function toDbUpdate(input) {
  return stripUndefined({
    name: input.name,
    plan: input.plan,
    amount: input.amount === undefined ? undefined : Number(input.amount),
    currency: input.currency,
    billing_cycle: input.billingCycle || input.cycle,
    next_charge_date: input.nextChargeDate || input.next,
    status: input.status,
    category: input.category,
    owner: input.owner,
    payment_method: input.paymentMethod || input.payment,
    website: input.website || input.url,
    notes: input.notes,
    usefulness: input.usefulness === undefined && input.value === undefined
      ? undefined
      : Number(input.usefulness || input.value),
    last_reviewed_at: input.lastReviewedAt
  });
}

function stripUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}
