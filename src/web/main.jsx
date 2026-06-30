import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarClock,
  CircleDollarSign,
  Command,
  ExternalLink,
  Filter,
  Gauge,
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

const categoryLabels = {
  ai: "AI",
  devtools: "开发",
  design: "设计",
  productivity: "效率",
  cloud: "云服务",
  media: "媒体",
  finance: "财务",
  other: "其他"
};

const statusLabels = {
  active: "使用中",
  trial: "试用",
  paused: "暂停",
  cancelled: "已取消"
};

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

function useSubscriptions(session) {
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
        if (!response.ok) throw new Error("无法读取订阅数据");
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
    if (!response.ok) throw new Error("保存失败，请检查金额和日期");
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

function AuthPanel() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const action = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await action;

    if (error) setMessage(error.message);
    else if (mode === "signup") setMessage("账号已创建。如果项目开启邮件确认，请先完成邮箱确认。");
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-line">
          <Command size={22} aria-hidden="true" />
          <span>Subscription Hub</span>
        </div>
        <h1>登录订阅管理中枢</h1>
        <form onSubmit={submit}>
          <label>
            邮箱
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {message && <p className="form-error">{message}</p>}
          <button className="primary-action" type="submit" disabled={busy}>
            {busy ? "处理中" : mode === "signin" ? "登录" : "创建账号"}
          </button>
        </form>
        <button className="link-button" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "没有账号，创建一个" : "已有账号，返回登录"}
        </button>
      </section>
    </main>
  );
}

function AddSubscriptionForm({ onCreate }) {
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
        <h2>新增订阅</h2>
      </div>

      <div className="form-grid">
        <label>
          名称
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
        </label>
        <label>
          套餐
          <input value={form.plan} onChange={(event) => updateField("plan", event.target.value)} />
        </label>
        <label>
          金额
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
          下次扣费
          <input
            type="date"
            value={form.nextChargeDate}
            onChange={(event) => updateField("nextChargeDate", event.target.value)}
            required
          />
        </label>
        <label>
          周期
          <select value={form.billingCycle} onChange={(event) => updateField("billingCycle", event.target.value)}>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
            <option value="quarterly">每季</option>
            <option value="annual">每年</option>
          </select>
        </label>
        <label>
          类别
          <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          管理者
          <select value={form.owner} onChange={(event) => updateField("owner", event.target.value)}>
            <option value="me">我</option>
            <option value="agent">Agent</option>
            <option value="team">团队</option>
          </select>
        </label>
        <label>
          价值评分
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
          备注
          <input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button className="primary-action" type="submit" disabled={saving}>
        <Plus size={18} aria-hidden="true" />
        {saving ? "保存中" : "添加订阅"}
      </button>
    </form>
  );
}

function SubscriptionRow({ item, onCancel, onRemove }) {
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
          <span>{item.plan || categoryLabels[item.category]}</span>
        </div>
        <p>{item.notes || "暂无备注"}</p>
        <div className="meta-line">
          <span>{categoryLabels[item.category]}</span>
          <span>{item.owner === "agent" ? "Agent 管理" : item.owner === "team" ? "团队" : "我管理"}</span>
          <span>{statusLabels[item.status]}</span>
        </div>
      </div>
      <div className="subscription-money">
        <strong>{formatMoney(Number(item.amount), item.currency)}</strong>
        <span>{cycleText(item.billingCycle)} · 月均 {formatMoney(monthlyEquivalent(item), item.currency)}</span>
      </div>
      <div className={`due ${isSoon ? "soon" : ""}`}>
        <CalendarClock size={18} aria-hidden="true" />
        <span>{item.nextChargeDate}</span>
        <strong>{dueIn >= 0 ? `${dueIn} 天后` : `已过 ${Math.abs(dueIn)} 天`}</strong>
      </div>
      <div className="row-actions">
        {item.website && (
          <a className="icon-button" href={item.website} target="_blank" rel="noreferrer" title="打开网站">
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        )}
        <button className="icon-button" onClick={cancel} disabled={busy || item.status === "cancelled"} title="标记取消">
          <XCircle size={18} aria-hidden="true" />
        </button>
        <button className="icon-button danger" onClick={remove} disabled={busy} title="删除">
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function cycleText(cycle) {
  return {
    weekly: "每周",
    monthly: "每月",
    quarterly: "每季",
    annual: "每年"
  }[cycle];
}

function App() {
  const auth = useAuth();
  const { items, loading, error, load, createItem, cancelItem, removeItem } = useSubscriptions(auth.session);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  if (hasSupabaseConfig && auth.loading) {
    return <main className="empty-state">正在检查登录状态</main>;
  }

  if (hasSupabaseConfig && !auth.session) {
    return <AuthPanel />;
  }

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

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="brand-line">
            <Command size={22} aria-hidden="true" />
            <span>Subscription Hub</span>
          </div>
          <h1>订阅管理中枢</h1>
        </div>
        <button className="refresh-button" onClick={load}>
          <RefreshCw size={18} aria-hidden="true" />
          刷新
        </button>
        {hasSupabaseConfig && (
          <button className="refresh-button" onClick={() => supabase.auth.signOut()}>
            <XCircle size={18} aria-hidden="true" />
            退出
          </button>
        )}
      </header>

      <section className="stats-band">
        <Stat icon={CircleDollarSign} label="月均支出" value={<MoneyTotals totals={summary.totalsByCurrency} field="monthlyTotal" />} tone="money" />
        <Stat icon={Gauge} label="年化支出" value={<MoneyTotals totals={summary.totalsByCurrency} field="annualTotal" />} tone="annual" />
        <Stat icon={CalendarClock} label="14 天内扣费" value={`${summary.dueSoon.length} 项`} tone="due" />
        <Stat icon={PauseCircle} label="低价值候选" value={`${summary.lowValue.length} 项`} tone="risk" />
      </section>

      <section className="decision-band">
        <Sparkles size={22} aria-hidden="true" />
        <div>
          <span>下一步建议</span>
          <strong>
            {nextDecision
              ? `检查 ${nextDecision.name}，下次扣费 ${nextDecision.nextChargeDate}，价值评分 ${nextDecision.usefulness}/5`
              : "目前没有紧急订阅，适合做一次月度复盘。"}
          </strong>
        </div>
      </section>

      <section className="workspace">
        <AddSubscriptionForm onCreate={createItem} />

        <section className="list-panel">
          <div className="panel-heading list-heading">
            <div>
              <Filter size={20} aria-hidden="true" />
              <h2>订阅列表</h2>
            </div>
            <span>{filtered.length} / {items.length}</span>
          </div>

          <div className="filters">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、套餐、备注" />
            </label>
            <div className="segmented" role="tablist" aria-label="状态筛选">
              {[
                ["all", "全部"],
                ["active", "使用中"],
                ["trial", "试用"],
                ["cancelled", "取消"]
              ].map(([value, label]) => (
                <button key={value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="empty-state">正在读取订阅数据</div>}
          {error && <div className="empty-state error">{error}</div>}
          {!loading && !error && filtered.length === 0 && <div className="empty-state">没有匹配的订阅</div>}
          <div className="rows">
            {filtered.map((item) => (
              <SubscriptionRow key={item.id} item={item} onCancel={cancelItem} onRemove={removeItem} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
