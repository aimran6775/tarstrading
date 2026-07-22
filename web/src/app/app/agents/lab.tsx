"use client";

import { useCallback, useEffect, useState } from "react";
import HoldButton from "@/components/hold-button";

/*
  The Agent Lab: your analyst floor. Hire (build), test honestly (70/30
  backtest), allocate (run), supervise (activity feed), and fire without
  sentiment (hold-to-kill). Every order an agent places is tagged — a fund
  where you can't audit your analysts is a casino with extra steps.
*/

type IndicatorRef =
  | { kind: "price" } | { kind: "sma"; period: number }
  | { kind: "ema"; period: number } | { kind: "rsi"; period: number }
  | { kind: "constant"; value: number };
type Rule = { lhs: IndicatorRef; comparator: string; rhs: IndicatorRef };
type Strategy = { universe: string[]; entry: Rule[]; exit: Rule[] };
type SegmentStats = { return: number; maxDrawdown: number; trades: number; winRate: number };
type Backtest = {
  splitIndex: number; barsUsed: number;
  inSample: SegmentStats; outOfSample: SegmentStats;
  equityCurve: { t: number; v: number }[];
  verdict: "pass" | "overfit-warning" | "no-trades";
};
type Agent = {
  id: string; name: string; emoji: string; strategy: Strategy;
  allocation: number; maxDrawdown: number;
  status: "draft" | "backtested" | "running" | "paused" | "killed";
  backtest: Backtest | null; thesis: string; pnl: number;
};
type Activity = { id: string; agentName: string; text: string; createdAt: number };

const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pctf = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function AgentLab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) { setAgents(data.agents); setActivity(data.activity); }
  }, []);

  useEffect(() => {
    load();
    // The desk tick fires app-wide from AppNav; here we just refresh the view.
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function act(id: string, action: string) {
    setBusy(id); setError(null);
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "That didn't work.");
    setBusy(null);
    load();
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    setBusy(null);
    load();
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-8">
      <p className="kicker mb-3">The agent lab</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl text-ink-1 md:text-5xl">Your analyst floor.</h1>
        <button onClick={() => setBuilding((b) => !b)}
          className="pressable cta-gold rounded-full px-6 py-3 text-sm font-semibold">
          {building ? "Close builder" : "Hire an agent"}
        </button>
      </div>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
        Agents run exactly the rules you write — nothing hidden. They must pass
        an honest backtest before they touch allocation, they narrate every
        decision, and they halt themselves at their drawdown limit. The kill
        switch is yours.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-loss">
          {error}
        </p>
      )}

      {building && <Builder onDone={() => { setBuilding(false); load(); }} />}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {agents.length === 0 && !building && (
          <section className="panel col-span-full flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-sm text-ink-2">No agents yet.</p>
            <p className="max-w-sm text-xs text-ink-4">
              Hire your first: a simple moving-average cross on one symbol,
              smallest allocation, drawdown limit set. Watch it work for a week
              before giving it a raise.
            </p>
          </section>
        )}
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} busy={busy === agent.id}
            onAction={(a) => act(agent.id, a)} onDelete={() => remove(agent.id)} />
        ))}
      </div>

      <section className="panel mt-8 overflow-hidden">
        <div className="border-b border-hairline px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Activity — every decision, narrated</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-ink-4">
            Nothing logged yet. Run an agent and this becomes the most honest trading diary you own.
          </p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 border-b border-hairline px-5 py-2.5 last:border-0">
                <span className="shrink-0 rounded-full bg-agent/12 px-2.5 py-0.5 text-[11px] font-medium text-agent">
                  {a.agentName}
                </span>
                <span className="text-xs leading-relaxed text-ink-2">{a.text}</span>
                <span className="tnum ml-auto shrink-0 text-[10px] text-ink-4">
                  {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-ink-4">
        Agents trade simulated capital only, while your desk is open. Every order is tagged and auditable.
      </p>
    </main>
  );
}

/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<Agent["status"], string> = {
  draft: "text-ink-4",
  backtested: "text-gold",
  running: "text-agent",
  paused: "text-ink-3",
  killed: "text-loss",
};

function AgentCard({ agent, busy, onAction, onDelete }: {
  agent: Agent; busy: boolean;
  onAction: (a: string) => void; onDelete: () => void;
}) {
  const bt = agent.backtest;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <section className={`card p-5 ${agent.status === "killed" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-ink-1">{agent.name}</p>
            <p className="tnum text-[11px] text-ink-4">
              {usd(agent.allocation)} · halts at −{pctf(agent.maxDrawdown)}
            </p>
            {(agent.status === "running" || agent.status === "paused" || agent.status === "killed") && (
              <p className={`tnum text-[11px] font-medium ${agent.pnl > 0 ? "text-gain" : agent.pnl < 0 ? "text-loss" : "text-ink-3"}`}>
                {agent.pnl >= 0 ? "+" : ""}{usd(agent.pnl)} live
              </p>
            )}
          </div>
        </div>
        <span className={`tnum text-[10px] uppercase tracking-[0.2em] ${STATUS_STYLE[agent.status]}`}>
          {agent.status === "running" && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-agent align-middle" />}
          {agent.status}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-3">{agent.thesis}</p>

      {bt && (
        <div className="mt-4">
          <BacktestStrip bt={bt} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(agent.status === "draft" || agent.status === "backtested" || agent.status === "paused") && (
          <button disabled={busy} onClick={() => onAction("backtest")}
            className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-1 hover:border-ink-4 disabled:opacity-50">
            {busy ? "Testing…" : bt ? "Re-test" : "Run honest backtest"}
          </button>
        )}
        {(agent.status === "backtested" || agent.status === "paused") && (
          <button disabled={busy} onClick={() => onAction("run")}
            className="pressable rounded-full bg-agent/15 px-4 py-2 text-xs font-semibold text-agent disabled:opacity-50">
            {agent.status === "paused" ? "Resume" : "Allocate & run"}
          </button>
        )}
        {agent.status === "running" && (
          <button disabled={busy} onClick={() => onAction("pause")}
            className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-1 disabled:opacity-50">
            Pause
          </button>
        )}
        {agent.status === "killed" && (
          <button disabled={busy} onClick={() => onAction("revive")}
            className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-2 disabled:opacity-50">
            Revive as draft
          </button>
        )}
        {agent.status !== "running" && agent.status !== "killed" && (
          confirmDelete ? (
            <span className="flex items-center gap-1.5">
              <button disabled={busy} onClick={onDelete}
                className="pressable rounded-full bg-loss/15 px-3 py-2 text-xs font-medium text-loss disabled:opacity-50">
                Delete for good
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="pressable rounded-full px-2 py-2 text-xs text-ink-4">Keep</button>
            </span>
          ) : (
            <button disabled={busy} onClick={() => setConfirmDelete(true)}
              className="pressable rounded-full px-3 py-2 text-xs text-ink-4 hover:text-loss disabled:opacity-50">
              Delete
            </button>
          )
        )}
      </div>

      {agent.status === "running" && (
        <div className="mt-3">
          <HoldButton label="Kill switch" holdLabel="Hold to kill…" tone="loss"
            disabled={busy} onCommit={() => onAction("kill")} />
        </div>
      )}
    </section>
  );
}

/** The honesty line: in-sample vs out-of-sample, side by side, no burying. */
function BacktestStrip({ bt }: { bt: Backtest }) {
  const curve = bt.equityCurve;
  const min = Math.min(...curve.map((p) => p.v));
  const max = Math.max(...curve.map((p) => p.v));
  const range = max - min || 1;
  const W = 280, H = 48;
  const pts = curve.map((p, i) =>
    `${((i / (curve.length - 1)) * W).toFixed(1)},${(H - ((p.v - min) / range) * H).toFixed(1)}`).join(" ");
  const splitX = (bt.splitIndex / (curve.length - 1)) * W;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
        <line x1={splitX} x2={splitX} y1="0" y2={H} stroke="var(--gold)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        <polyline points={pts} fill="none" stroke="var(--agent)" strokeWidth="1.5" />
      </svg>
      <div className="tnum mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-bg3/60 px-2.5 py-1.5">
          <span className="text-ink-4">In-sample · </span>
          <span className={bt.inSample.return >= 0 ? "text-gain" : "text-loss"}>{pctf(bt.inSample.return)}</span>
          <span className="text-ink-4"> · {pctf(bt.inSample.winRate)} wins · {bt.inSample.trades} trades</span>
        </div>
        <div className="rounded-md border border-gold/25 bg-gold/8 px-2.5 py-1.5">
          <span className="text-gold">Out-of-sample · </span>
          <span className={bt.outOfSample.return >= 0 ? "text-gain" : "text-loss"}>{pctf(bt.outOfSample.return)}</span>
          <span className="text-ink-4"> · {pctf(bt.outOfSample.winRate)} wins · {bt.outOfSample.trades} trades</span>
        </div>
      </div>
      {bt.verdict === "overfit-warning" && (
        <p className="mt-2 text-[11px] text-warning">
          Overfit warning: brilliant in-sample, coin-flip out-of-sample. This résumé memorized the interview questions.
        </p>
      )}
      {bt.verdict === "no-trades" && (
        <p className="mt-2 text-[11px] text-ink-4">
          The rules never fired in a year of data. An analyst who never acts isn&apos;t cautious — they&apos;re furniture.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const INDICATORS = [
  { label: "Price", value: "price" },
  { label: "SMA", value: "sma" },
  { label: "EMA", value: "ema" },
  { label: "RSI", value: "rsi" },
  { label: "Number", value: "constant" },
] as const;

const COMPARATORS = [
  { label: "crosses above", value: "crossesAbove" },
  { label: "crosses below", value: "crossesBelow" },
  { label: "is above", value: "greaterThan" },
  { label: "is below", value: "lessThan" },
] as const;

type RefDraft = { kind: string; period: string; value: string };
type RuleDraft = { lhs: RefDraft; comparator: string; rhs: RefDraft };

const defaultEntry: RuleDraft = {
  lhs: { kind: "sma", period: "20", value: "" },
  comparator: "crossesAbove",
  rhs: { kind: "sma", period: "50", value: "" },
};
const defaultExit: RuleDraft = {
  lhs: { kind: "sma", period: "20", value: "" },
  comparator: "crossesBelow",
  rhs: { kind: "sma", period: "50", value: "" },
};

function toRef(d: RefDraft): IndicatorRef {
  if (d.kind === "price") return { kind: "price" };
  if (d.kind === "constant") return { kind: "constant", value: Number(d.value) || 0 };
  return { kind: d.kind as "sma" | "ema" | "rsi", period: Math.max(2, Math.min(200, Number(d.period) || 20)) };
}

function Builder({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [universe, setUniverse] = useState("AAPL");
  const [allocation, setAllocation] = useState(5000);
  const [maxDD, setMaxDD] = useState(20);
  const [cash, setCash] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/account").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.ok) setCash(d.account?.cash ?? null);
    }).catch(() => {});
  }, []);
  const overCash = cash != null && allocation > cash;
  const [entry, setEntry] = useState<RuleDraft[]>([defaultEntry]);
  const [exit, setExit] = useState<RuleDraft[]>([defaultExit]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function hire() {
    setBusy(true); setError(null);
    const strategy = {
      universe: universe.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      entry: entry.map((r) => ({ lhs: toRef(r.lhs), comparator: r.comparator, rhs: toRef(r.rhs) })),
      exit: exit.map((r) => ({ lhs: toRef(r.lhs), comparator: r.comparator, rhs: toRef(r.rhs) })),
    };
    const res = await fetch("/api/agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji, strategy, allocation, maxDrawdown: maxDD / 100 }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) onDone();
    else setError(data.error ?? "Couldn't create the agent.");
  }

  return (
    <section className="card mt-8 p-5 md:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">New hire</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-[64px_1fr_1fr]">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji"
          className="rounded-lg border border-hairline bg-bg1 px-3 py-2.5 text-center text-lg outline-none focus:border-gold" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Golden Cross"
          className="rounded-lg border border-hairline bg-bg1 px-3.5 py-2.5 text-sm text-ink-1 outline-none focus:border-gold" />
        <input value={universe} onChange={(e) => setUniverse(e.target.value)} placeholder="Universe — AAPL, BTC/USD"
          className="rounded-lg border border-hairline bg-bg1 px-3.5 py-2.5 text-sm text-ink-1 outline-none focus:border-gold" />
      </div>

      <RuleEditor title="Entry — ALL must be true" rules={entry} setRules={setEntry} />
      <RuleEditor title="Exit — ANY fires the sell" rules={exit} setRules={setExit} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="tnum text-xs text-ink-3">Allocation: {usd(allocation)}</span>
          <input type="range" min={500} max={50000} step={500} value={allocation}
            onChange={(e) => setAllocation(Number(e.target.value))} className="accent-[var(--gold)]" />
          <span className="text-[11px] text-ink-4">Simulated capital only. It spends this, not your rent.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="tnum text-xs text-ink-3">Halt at drawdown: −{maxDD}%</span>
          <input type="range" min={5} max={50} step={5} value={maxDD}
            onChange={(e) => setMaxDD(Number(e.target.value))} className="accent-[var(--loss)]" />
          <span className="text-[11px] text-ink-4">Even your best analyst doesn&apos;t lose unsupervised.</span>
        </label>
      </div>

      {overCash && (
        <p className="mt-4 text-sm text-warning">
          Allocation exceeds your {usd(cash!)} of simulated cash. Lower it, or fund the desk with a few winning trades first.
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-loss">{error}</p>}

      <button disabled={busy || overCash} onClick={hire}
        className="pressable cta-gold mt-5 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-50">
        {busy ? "Hiring…" : "Hire agent (starts as draft)"}
      </button>
    </section>
  );
}

function RuleEditor({ title, rules, setRules }: {
  title: string; rules: RuleDraft[]; setRules: (r: RuleDraft[]) => void;
}) {
  function update(i: number, patch: Partial<RuleDraft>) {
    setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  return (
    <div className="mt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-4">{title}</p>
      {rules.map((rule, i) => (
        <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
          <span className="tnum text-[11px] text-ink-4">IF</span>
          <RefEditor value={rule.lhs} onChange={(lhs) => update(i, { lhs })} allowConstant={false} />
          <select value={rule.comparator} onChange={(e) => update(i, { comparator: e.target.value })}
            className="rounded-lg border border-hairline bg-bg1 px-2.5 py-2 text-xs text-ink-1 outline-none focus:border-gold">
            {COMPARATORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <RefEditor value={rule.rhs} onChange={(rhs) => update(i, { rhs })} allowConstant />
          {rules.length > 1 && (
            <button onClick={() => setRules(rules.filter((_, j) => j !== i))}
              className="pressable px-2 text-xs text-ink-4 hover:text-loss" aria-label="Remove rule">×</button>
          )}
        </div>
      ))}
      {rules.length < 3 && (
        <button onClick={() => setRules([...rules, structuredClone(rules[0])])}
          className="pressable mt-2 text-xs text-gold hover:underline">+ rule</button>
      )}
    </div>
  );
}

function RefEditor({ value, onChange, allowConstant }: {
  value: RefDraft; onChange: (v: RefDraft) => void; allowConstant: boolean;
}) {
  const needsPeriod = ["sma", "ema", "rsi"].includes(value.kind);
  return (
    <span className="flex items-center gap-1.5">
      <select value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value })}
        className="rounded-lg border border-hairline bg-bg1 px-2.5 py-2 text-xs text-ink-1 outline-none focus:border-gold">
        {INDICATORS.filter((i) => allowConstant || i.value !== "constant")
          .map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
      </select>
      {needsPeriod && (
        <input value={value.period} onChange={(e) => onChange({ ...value, period: e.target.value.replace(/\D/g, "") })}
          className="tnum w-14 rounded-lg border border-hairline bg-bg1 px-2 py-2 text-center text-xs text-ink-1 outline-none focus:border-gold"
          aria-label="Period" />
      )}
      {value.kind === "constant" && (
        <input value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value.replace(/[^\d.]/g, "") })}
          className="tnum w-16 rounded-lg border border-hairline bg-bg1 px-2 py-2 text-center text-xs text-ink-1 outline-none focus:border-gold"
          aria-label="Value" />
      )}
    </span>
  );
}
