import { Command } from "commander";
import * as cloudStore from "./cloudStore.js";
import * as localStore from "../server/store.js";
import { daysUntil, formatMoney, monthlyEquivalent } from "../shared/schema.js";

const program = new Command();

program
  .name("subhub")
  .description("Manage Subscription Hub from the command line.")
  .version("0.1.0")
  .option("--remote", "Use Supabase cloud mode")
  .option("--local", "Use local JSON mode");

function store() {
  const options = program.opts();
  if (options.remote || (!options.local && process.env.SUBHUB_MODE === "cloud")) {
    return cloudStore;
  }
  return localStore;
}

function cleanOptions(options) {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined && value !== "")
  );
}

function printTable(items) {
  if (!items.length) {
    console.log("No subscriptions found.");
    return;
  }

  const rows = items.map((item) => ({
    id: item.id,
    name: `${item.name}${item.plan ? ` (${item.plan})` : ""}`,
    cost: `${formatMoney(Number(item.amount), item.currency)}/${item.billingCycle}`,
    monthly: formatMoney(monthlyEquivalent(item), item.currency),
    next: `${item.nextChargeDate} (${daysUntil(item.nextChargeDate)}d)`,
    status: item.status,
    owner: item.owner,
    value: item.usefulness
  }));

  console.table(rows);
}

program
  .command("list")
  .description("List subscriptions.")
  .option("--status <status>", "Filter by status")
  .option("--owner <owner>", "Filter by owner")
  .option("--category <category>", "Filter by category")
  .option("--json", "Print raw JSON")
  .action(async (options) => {
    const items = await store().listSubscriptions(cleanOptions(options));
    if (options.json) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }
    printTable(items);
  });

program
  .command("add")
  .description("Add a subscription.")
  .requiredOption("--name <name>", "Subscription name")
  .requiredOption("--amount <amount>", "Billing amount")
  .requiredOption("--next <yyyy-mm-dd>", "Next charge date")
  .option("--cycle <cycle>", "weekly, monthly, quarterly, annual", "monthly")
  .option("--currency <currency>", "Currency code", "USD")
  .option("--plan <plan>", "Plan name")
  .option("--status <status>", "active, trial, paused, cancelled", "active")
  .option("--category <category>", "Category", "other")
  .option("--owner <owner>", "me, agent, team", "me")
  .option("--payment <paymentMethod>", "Payment method")
  .option("--url <website>", "Website URL")
  .option("--notes <notes>", "Notes")
  .option("--value <usefulness>", "Usefulness score from 1 to 5", "3")
  .action(async (options) => {
    const item = await store().createSubscription({
      name: options.name,
      amount: options.amount,
      nextChargeDate: options.next,
      billingCycle: options.cycle,
      currency: options.currency,
      plan: options.plan,
      status: options.status,
      category: options.category,
      owner: options.owner,
      paymentMethod: options.payment,
      website: options.url,
      notes: options.notes,
      usefulness: options.value
    });
    console.log(`Added ${item.name} as ${item.id}.`);
  });

program
  .command("show")
  .description("Show one subscription by id or exact name.")
  .argument("<id>")
  .action(async (id) => {
    const item = await store().getSubscription(id);
    if (!item) {
      console.error("Subscription not found.");
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(item, null, 2));
  });

program
  .command("update")
  .description("Update a subscription by id or exact name.")
  .argument("<id>")
  .option("--name <name>", "Subscription name")
  .option("--amount <amount>", "Billing amount")
  .option("--next <yyyy-mm-dd>", "Next charge date")
  .option("--cycle <billingCycle>", "weekly, monthly, quarterly, annual")
  .option("--currency <currency>", "Currency code")
  .option("--plan <plan>", "Plan name")
  .option("--status <status>", "active, trial, paused, cancelled")
  .option("--category <category>", "Category")
  .option("--owner <owner>", "me, agent, team")
  .option("--payment <paymentMethod>", "Payment method")
  .option("--url <website>", "Website URL")
  .option("--notes <notes>", "Notes")
  .option("--value <usefulness>", "Usefulness score from 1 to 5")
  .action(async (id, options) => {
    const patch = cleanOptions({
      name: options.name,
      amount: options.amount,
      nextChargeDate: options.next,
      billingCycle: options.cycle,
      currency: options.currency,
      plan: options.plan,
      status: options.status,
      category: options.category,
      owner: options.owner,
      paymentMethod: options.payment,
      website: options.url,
      notes: options.notes,
      usefulness: options.value
    });
    const item = await store().updateSubscription(id, patch);
    if (!item) {
      console.error("Subscription not found.");
      process.exitCode = 1;
      return;
    }
    console.log(`Updated ${item.name}.`);
  });

program
  .command("cancel")
  .description("Mark a subscription as cancelled.")
  .argument("<id>")
  .action(async (id) => {
    const item = await store().cancelSubscription(id);
    if (!item) {
      console.error("Subscription not found.");
      process.exitCode = 1;
      return;
    }
    console.log(`Marked ${item.name} as cancelled.`);
  });

program
  .command("remove")
  .description("Remove a subscription.")
  .argument("<id>")
  .action(async (id) => {
    const removed = await store().deleteSubscription(id);
    if (!removed) {
      console.error("Subscription not found.");
      process.exitCode = 1;
      return;
    }
    console.log("Removed subscription.");
  });

program
  .command("due")
  .description("List subscriptions due soon.")
  .option("--days <days>", "Window in days", "14")
  .option("--json", "Print raw JSON")
  .action(async (options) => {
    const items = await store().listSubscriptions();
    const windowDays = Number(options.days);
    const due = items
      .map((item) => ({ ...item, daysUntil: daysUntil(item.nextChargeDate) }))
      .filter((item) => item.status !== "cancelled" && item.daysUntil >= 0 && item.daysUntil <= windowDays)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (options.json) {
      console.log(JSON.stringify(due, null, 2));
      return;
    }
    printTable(due);
  });

program
  .command("summary")
  .description("Show monthly and annual subscription totals.")
  .action(async () => {
    const summary = await store().subscriptionSummary();
    console.log(`Active or trial subscriptions: ${summary.activeCount}/${summary.count}`);
    if (summary.totalsByCurrency.length) {
      console.log("Estimated monthly spend:");
      for (const total of summary.totalsByCurrency) {
        console.log(`  ${formatMoney(total.monthlyTotal, total.currency)}`);
      }
      console.log("Estimated annual spend:");
      for (const total of summary.totalsByCurrency) {
        console.log(`  ${formatMoney(total.annualTotal, total.currency)}`);
      }
    } else {
      console.log("Estimated monthly spend: $0");
      console.log("Estimated annual spend: $0");
    }
    if (summary.dueSoon.length) {
      console.log("\nDue in the next 14 days:");
      printTable(summary.dueSoon);
    }
    if (summary.lowValue.length) {
      console.log("\nLow-value candidates:");
      printTable(summary.lowValue);
    }
  });

const cloud = program
  .command("cloud")
  .description("Configure and inspect Supabase cloud mode.");

cloud
  .command("configure")
  .description("Store Supabase URL and anon key for remote CLI operations.")
  .requiredOption("--url <url>", "Supabase project URL")
  .requiredOption("--anon-key <key>", "Supabase anon public key")
  .action(async (options) => {
    await cloudStore.configureCloud({ url: options.url, anonKey: options.anonKey });
    console.log("Cloud mode configured.");
  });

cloud
  .command("login")
  .description("Log in to Supabase for remote CLI operations.")
  .requiredOption("--email <email>", "Account email")
  .requiredOption("--password <password>", "Account password")
  .action(async (options) => {
    const user = await cloudStore.loginCloud(options);
    console.log(`Logged in as ${user.email}.`);
  });

cloud
  .command("connect-project")
  .description("Connect remote CLI operations to a Supabase project and Google-auth user.")
  .requiredOption("--project-ref <ref>", "Supabase project ref")
  .requiredOption("--user-email <email>", "Supabase user email that owns managed subscriptions")
  .option("--url <url>", "Supabase project URL")
  .option("--anon-key <key>", "Supabase anon public key")
  .option("--service-role-key <key>", "Supabase service role key. If omitted, subhub reads it through Supabase CLI.")
  .action(async (options) => {
    const user = await cloudStore.connectProjectCloud({
      projectRef: options.projectRef,
      userEmail: options.userEmail,
      url: options.url,
      anonKey: options.anonKey,
      serviceRoleKey: options.serviceRoleKey
    });
    console.log(`Connected ${user.projectRef} for ${user.email}.`);
  });

cloud
  .command("whoami")
  .description("Show the current Supabase CLI identity.")
  .action(async () => {
    const user = await cloudStore.whoamiCloud();
    console.log(`${user.email} (${user.id})`);
  });

cloud
  .command("logout")
  .description("Remove stored Supabase session tokens.")
  .action(async () => {
    await cloudStore.logoutCloud();
    console.log("Logged out of cloud mode.");
  });

cloud
  .command("import-local")
  .description("Upsert local JSON subscriptions into the configured Supabase account.")
  .option("--dry-run", "Preview the import without writing to Supabase")
  .action(async (options) => {
    const items = await localStore.listSubscriptions();
    if (options.dryRun) {
      console.log(`Would import ${items.length} subscriptions.`);
      printTable(items);
      return;
    }

    const imported = await cloudStore.upsertSubscriptions(items);
    console.log(`Upserted ${imported.length} subscriptions into cloud mode.`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
