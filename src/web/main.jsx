import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarClock,
  CircleDollarSign,
  Command,
  ExternalLink,
  Filter,
  Gauge,
  Github,
  Languages,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  XCircle
} from "lucide-react";
import { fromDbRow, toDbInsert } from "../shared/dbMapping.js";
import { daysUntil, formatMoney, monthlyEquivalent, summarizeSubscriptions } from "../shared/schema.js";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";
import "./styles.css";

const repoUrl = "https://github.com/IIIIQIIII/subscription-hub";

const emptyForm = {
  name: "",
  plan: "",
  amount: "",
  currency: "USD",
  billingCycle: "monthly",
  nextChargeDate: "",
  status: "active",
  category: "ai",
  owner: "me",
  paymentMethod: "",
  website: "",
  notes: "",
  usefulness: 3
};

const copy = {
  en: {
    categories: {
      ai: "AI",
      devtools: "Dev tools",
      design: "Design",
      productivity: "Productivity",
      cloud: "Cloud",
      media: "Media",
      finance: "Finance",
      other: "Other"
    },
    statuses: {
      active: "Active",
      trial: "Trial",
      paused: "Paused",
      cancelled: "Cancelled"
    },
    cycles: {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      annual: "Annual"
    },
    owners: {
      me: "Managed by me",
      agent: "Managed by Agent",
      team: "Team"
    },
    shortOwners: {
      me: "Me",
      agent: "Agent",
      team: "Team"
    },
    authTitle: "Sign in to Subscription Hub",
    signInBusy: "Redirecting",
    signInGoogle: "Continue with Google",
    openSource: "Open source",
    refresh: "Refresh",
    signOut: "Sign out",
    appTitle: "Subscription Hub",
    stats: {
      monthly: "Monthly spend",
      annual: "Annualized spend",
      due: "Due in 14 days",
      lowValue: "Low-value candidates"
    },
    items: "items",
    decisionTitle: "Next suggested action",
    decisionEmpty: "No urgent subscriptions right now. Good time for a monthly review.",
    decisionText: (item) => `Review ${item.name}: next charge ${item.nextChargeDate}, value score ${item.usefulness}/5`,
    addTitle: "Add subscription",
    fields: {
      name: "Name",
      plan: "Plan",
      amount: "Amount",
      nextCharge: "Next charge",
      cycle: "Cycle",
      category: "Category",
      owner: "Owner",
      value: "Value score",
      notes: "Notes"
    },
    saving: "Saving",
    addButton: "Add subscription",
    noNotes: "No notes",
    monthlyAverage: "monthly avg",
    dueFuture: (days) => `${days} days left`,
    duePast: (days) => `${days} days overdue`,
    openWebsite: "Open website",
    markCancelled: "Mark cancelled",
    delete: "Delete",
    listTitle: "Subscriptions",
    searchPlaceholder: "Search name, plan, notes",
    statusFilter: "Status filter",
    filters: {
      all: "All",
      active: "Active",
      trial: "Trial",
      cancelled: "Cancelled"
    },
    authChecking: "Checking sign-in status",
    loadingData: "Loading subscriptions",
    emptyList: "No matching subscriptions",
    readError: "Unable to read subscription data",
    saveError: "Save failed. Check the amount and date."
  },
  zh: {
    categories: {
      ai: "AI",
      devtools: "开发",
      design: "设计",
      productivity: "效率",
      cloud: "云服务",
      media: "媒体",
      finance: "财务",
      other: "其他"
    },
    statuses: {
      active: "使用中",
      trial: "试用",
      paused: "暂停",
      cancelled: "已取消"
    },
    cycles: {
      weekly: "每周",
      monthly: "每月",
      quarterly: "每季",
      annual: "每年"
    },
    owners: {
      me: "我管理",
      agent: "Agent 管理",
      team: "团队"
    },
    shortOwners: {
      me: "我",
      agent: "Agent",
      team: "团队"
    },
    authTitle: "登录订阅管理中枢",
    signInBusy: "正在跳转",
    signInGoogle: "使用 Google 登录",
    openSource: "开源项目",
    refresh: "刷新",
    signOut: "退出",
    appTitle: "订阅管理中枢",
    stats: {
      monthly: "月均支出",
      annual: "年化支出",
      due: "14 天内扣费",
      lowValue: "低价值候选"
    },
    items: "项",
    decisionTitle: "下一步建议",
    decisionEmpty: "目前没有紧急订阅，适合做一次月度复盘。",
    decisionText: (item) => `检查 ${item.name}，下次扣费 ${item.nextChargeDate}，价值评分 ${item.usefulness}/5`,
    addTitle: "新增订阅",
    fields: {
      name: "名称",
      plan: "套餐",
      amount: "金额",
      nextCharge: "下次扣费",
      cycle: "周期",
      category: "类别",
      owner: "管理者",
      value: "价值评分",
      notes: "备注"
    },
    saving: "保存中",
    addButton: "添加订阅",
    noNotes: "暂无备注",
    monthlyAverage: "月均",
    dueFuture: (days) => `${days} 天后`,
    duePast: (days) => `已过 ${days} 天`,
    openWebsite: "打开网站",
    markCancelled: "标记取消",
    delete: "删除",
    listTitle: "订阅列表",
    searchPlaceholder: "搜索名称、套餐、备注",
    statusFilter: "状态筛选",
    filters: {
      all: "全部",
      active: "使用中",
      trial: "试用",
      cancelled: "取消"
    },
    authChecking: "正在检查登录状态",
    loadingData: "正在读取订阅数据",
    emptyList: "没有匹配的订阅",
    readError: "无法读取订阅数据",
    saveError: "保存失败，请检查金额和日期"
  }
};

function initialLanguage() {
  return window.localStorage.getItem("subhub-language") === "zh" ? "zh" : "en";
}

function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

function useSubscriptions(session, t) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (hasSupabaseConfig) {
        const { data, error: queryError } = await supabase
          .from("subscriptions")
          .select("*")
          .order("next_charge_date", { ascending: true });
        if (queryError) throw queryError;
        setItems(data.map(fromDbRow));
      } else {
        const response = await fetch("/api/subscriptions");
        if (!response.ok) throw new Error(t.readError);
        setItems(await response.json());
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasSupabaseConfig || session) load();
  }, [session?.user?.id]);

  async function createItem(input) {
    if (hasSupabaseConfig) {
      const { data, error: insertError } = await supabase
        .from("subscriptions")
        .insert(toDbInsert(input, session.user.id))
        .select("*")
        .single();
      if (insertError) throw insertError;
      const created = fromDbRow(data);
      setItems((current) => [...current, created].sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate)));
      return created;
    }

    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error(t.saveError);
    const created = await response.json();
    setItems((current) => [...current, created].sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate)));
    return created;
  }

  async function cancelItem(id) {
    if (hasSupabaseConfig) {
      const current = items.find((item) => item.id === id);
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          notes: `Cancelled or marked for cancellation on ${new Date().toISOString().slice(0, 10)}.${current?.notes ? ` ${current.notes}` : ""}`
        })
        .eq("id", id);
      if (updateError) throw updateError;
      await load();
      return;
    }

    await fetch(`/api/subscriptions/${id}/cancel`, { method: "POST" });
    await load();
  }

  async function removeItem(id) {
    if (hasSupabaseConfig) {
      const { error: deleteError } = await supabase.from("subscriptions").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setItems((current) => current.filter((item) => item.id !== id));
      return;
    }

    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    await load();
  }

  return { items, loading, error, load, createItem, cancelItem, removeItem };
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <section className={`stat stat-${tone}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function MoneyTotals({ totals, field }) {
  if (!totals.length) return formatMoney(0, "USD");
  return (
    <span className="money-stack">
      {totals.map((total) => (
        <span key={total.currency}>{formatMoney(total[field], total.currency)}</span>
      ))}
    </span>
  );
}

function AuthPanel({ t }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) setMessage(error.message);
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-line">
          <Command size={22} aria-hidden="true" />
          <span>Subscription Hub</span>
        </div>
        <h1>{t.authTitle}</h1>
        <button className="google-action" type="button" onClick={signInWithGoogle} disabled={busy}>
          <span aria-hidden="true">G</span>
          {busy ? t.signInBusy : t.signInGoogle}
        </button>
        <a className="source-link" href={repoUrl} target="_blank" rel="noreferrer">
          <Github size={18} aria-hidden="true" />
          {t.openSource}
        </a>
        {message && <p className="form-error">{message}</p>}
      </section>
    </main>
  );
}

function AddSubscriptionForm({ onCreate, t }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onCreate(form);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="add-panel" onSubmit={submit}>
      <div className="panel-heading">
        <Plus size={20} aria-hidden="true" />
        <h2>{t.addTitle}</h2>
      </div>

      <div className="form-grid">
        <label>
          {t.fields.name}
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
        </label>
        <label>
          {t.fields.plan}
          <input value={form.plan} onChange={(event) => updateField("plan", event.target.value)} />
        </label>
        <label>
          {t.fields.amount}
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            required
          />
        </label>
        <label>
          {t.fields.nextCharge}
          <input
            type="date"
            value={form.nextChargeDate}
            onChange={(event) => updateField("nextChargeDate", event.target.value)}
            required
          />
        </label>
        <label>
          {t.fields.cycle}
          <select value={form.billingCycle} onChange={(event) => updateField("billingCycle", event.target.value)}>
            {Object.entries(t.cycles).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          {t.fields.category}
          <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
            {Object.entries(t.categories).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          {t.fields.owner}
          <select value={form.owner} onChange={(event) => updateField("owner", event.target.value)}>
            {Object.entries(t.shortOwners).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          {t.fields.value}
          <input
            type="range"
            min="1"
            max="5"
            value={form.usefulness}
            onChange={(event) => updateField("usefulness", Number(event.target.value))}
          />
          <span className="range-value">{form.usefulness}/5</span>
        </label>
        <label className="wide">
          {t.fields.notes}
          <input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button className="primary-action" type="submit" disabled={saving}>
        <Plus size={18} aria-hidden="true" />
        {saving ? t.saving : t.addButton}
      </button>
    </form>
  );
}

function SubscriptionRow({ item, onCancel, onRemove, t }) {
  const [busy, setBusy] = useState(false);
  const dueIn = daysUntil(item.nextChargeDate);
  const isSoon = dueIn >= 0 && dueIn <= 7;

  async function cancel() {
    setBusy(true);
    await onCancel(item.id);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await onRemove(item.id);
    setBusy(false);
  }

  return (
    <article className={`subscription-row ${item.status}`}>
      <div className="service-mark" data-category={item.category}>
        {item.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="subscription-main">
        <div className="name-line">
          <h3>{item.name}</h3>
          <span>{item.plan || t.categories[item.category]}</span>
        </div>
        <p>{item.notes || t.noNotes}</p>
        <div className="meta-line">
          <span>{t.categories[item.category]}</span>
          <span>{t.owners[item.owner]}</span>
          <span>{t.statuses[item.status]}</span>
        </div>
      </div>
      <div className="subscription-money">
        <strong>{formatMoney(Number(item.amount), item.currency)}</strong>
        <span>{t.cycles[item.billingCycle]} · {t.monthlyAverage} {formatMoney(monthlyEquivalent(item), item.currency)}</span>
      </div>
      <div className={`due ${isSoon ? "soon" : ""}`}>
        <CalendarClock size={18} aria-hidden="true" />
        <span>{item.nextChargeDate}</span>
        <strong>{dueIn >= 0 ? t.dueFuture(dueIn) : t.duePast(Math.abs(dueIn))}</strong>
      </div>
      <div className="row-actions">
        {item.website && (
          <a className="icon-button" href={item.website} target="_blank" rel="noreferrer" title={t.openWebsite}>
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        )}
        <button className="icon-button" onClick={cancel} disabled={busy || item.status === "cancelled"} title={t.markCancelled}>
          <XCircle size={18} aria-hidden="true" />
        </button>
        <button className="icon-button danger" onClick={remove} disabled={busy} title={t.delete}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function App() {
  const [language, setLanguage] = useState(initialLanguage);
  const t = copy[language];
  const auth = useAuth();
  const { items, loading, error, load, createItem, cancelItem, removeItem } = useSubscriptions(auth.session, t);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    window.localStorage.setItem("subhub-language", language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesQuery = `${item.name} ${item.plan} ${item.notes}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" || item.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [items, query, status]);

  const summary = useMemo(() => summarizeSubscriptions(items), [items]);
  const nextDecision = useMemo(() => {
    return summary.dueSoon[0] || summary.lowValue[0];
  }, [summary]);

  if (hasSupabaseConfig && auth.loading) {
    return <main className="empty-state">{t.authChecking}</main>;
  }

  if (hasSupabaseConfig && !auth.session) {
    return <AuthPanel t={t} />;
  }

  return (
    <main>
      <header className="topbar">
        <div className="title-block">
          <div className="brand-line">
            <Command size={22} aria-hidden="true" />
            <span>Subscription Hub</span>
          </div>
          <h1>{t.appTitle}</h1>
        </div>
        <div className="topbar-actions">
          <a className="refresh-button" href={repoUrl} target="_blank" rel="noreferrer">
            <Github size={18} aria-hidden="true" />
            GitHub
          </a>
          <div className="language-toggle" aria-label="Language">
            <Languages size={18} aria-hidden="true" />
            <button className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>EN</button>
            <button className={language === "zh" ? "selected" : ""} onClick={() => setLanguage("zh")}>中文</button>
          </div>
          <button className="refresh-button" onClick={load}>
            <RefreshCw size={18} aria-hidden="true" />
            {t.refresh}
          </button>
          {hasSupabaseConfig && (
            <button className="refresh-button" onClick={() => supabase.auth.signOut()}>
              <XCircle size={18} aria-hidden="true" />
              {t.signOut}
            </button>
          )}
        </div>
      </header>

      <section className="stats-band">
        <Stat icon={CircleDollarSign} label={t.stats.monthly} value={<MoneyTotals totals={summary.totalsByCurrency} field="monthlyTotal" />} tone="money" />
        <Stat icon={Gauge} label={t.stats.annual} value={<MoneyTotals totals={summary.totalsByCurrency} field="annualTotal" />} tone="annual" />
        <Stat icon={CalendarClock} label={t.stats.due} value={`${summary.dueSoon.length} ${t.items}`} tone="due" />
        <Stat icon={PauseCircle} label={t.stats.lowValue} value={`${summary.lowValue.length} ${t.items}`} tone="risk" />
      </section>

      <section className="decision-band">
        <Sparkles size={22} aria-hidden="true" />
        <div>
          <span>{t.decisionTitle}</span>
          <strong>
            {nextDecision
              ? t.decisionText(nextDecision)
              : t.decisionEmpty}
          </strong>
        </div>
      </section>

      <section className="workspace">
        <AddSubscriptionForm onCreate={createItem} t={t} />

        <section className="list-panel">
          <div className="panel-heading list-heading">
            <div>
              <Filter size={20} aria-hidden="true" />
              <h2>{t.listTitle}</h2>
            </div>
            <span>{filtered.length} / {items.length}</span>
          </div>

          <div className="filters">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} />
            </label>
            <div className="segmented" role="tablist" aria-label={t.statusFilter}>
              {[
                ["all", t.filters.all],
                ["active", t.filters.active],
                ["trial", t.filters.trial],
                ["cancelled", t.filters.cancelled]
              ].map(([value, label]) => (
                <button key={value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="empty-state">{t.loadingData}</div>}
          {error && <div className="empty-state error">{error}</div>}
          {!loading && !error && filtered.length === 0 && <div className="empty-state">{t.emptyList}</div>}
          <div className="rows">
            {filtered.map((item) => (
              <SubscriptionRow key={item.id} item={item} onCancel={cancelItem} onRemove={removeItem} t={t} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
