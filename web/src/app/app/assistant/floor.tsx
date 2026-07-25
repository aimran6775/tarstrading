"use client";

import { useCallback, useEffect, useState } from "react";
import HoldButton from "@/components/hold-button";
import AssistantChat from "@/components/assistant-chat";
import LearnLink from "@/components/academy/learn-link";
import { Icon } from "@/components/icons";

/*
  The Agent Lab: your analyst floor, run by conversation. You TALK to your
  analyst — plain English in, transparent rules out: it hires (compiles your
  strategy), tests honestly (70/30 backtest), deploys, pauses, and kills on
  your word, and remembers the whole conversation. The roster alongside is
  the audit view: live status, P&L, and a kill switch that never needs the
  model's permission.
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

export default function AnalystFloor() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
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
      <div className="mb-3 flex items-center gap-3">
        <p className="kicker">The assistant</p>
        <LearnLink concept="ai" />
      </div>
      <h1 className="display text-4xl text-ink-1 md:text-5xl">Talk to your assistant.</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
        Tell it what you want and it hires an analyst to run it — plain English
        in, transparent rules out. It backtests honestly and deploys on your
        word, and it remembers everything. Analysts halt at their drawdown
        limit, and the kill switch is always yours.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-loss">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* The conversation IS the builder. */}
        <AssistantChat onDeskChanged={load} />

        {/* The roster — audit view + hard controls. */}
        <div className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
          {agents.length === 0 && (
            <section className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p className="text-sm text-ink-2">The floor is empty.</p>
              <p className="max-w-sm text-xs text-ink-4">
                Ask your assistant to hire one — a single symbol, a simple
                moving-average cross, smallest allocation. Watch it work for a
                week before giving it a raise.
              </p>
            </section>
          )}
          {agents.map((agent) => (
            <AnalystCard key={agent.id} agent={agent} busy={busy === agent.id}
              onAction={(a) => act(agent.id, a)} onDelete={() => remove(agent.id)} />
          ))}
        </div>
      </div>

      <section className="panel mt-8 overflow-hidden">
        <div className="border-b border-hairline px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Activity — every decision, narrated</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-ink-4">
            Nothing logged yet. Put an analyst to work and this becomes the most honest trading diary you own.
          </p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 border-b border-hairline px-5 py-2.5 last:border-0">
                <span className="shrink-0 rounded-full bg-agent/12 px-2.5 py-0.5 text-[11px] font-medium text-agent">
                  {a.agentName}
                </span>
                <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-ink-2">{a.text}</span>
                <span className="tnum ml-auto shrink-0 text-[10px] text-ink-4">
                  {new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-ink-4">
        Your analysts trade simulated capital only, while your desk is open. Every order is tagged and auditable.
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

function AnalystCard({ agent, busy, onAction, onDelete }: {
  agent: Agent; busy: boolean;
  onAction: (a: string) => void; onDelete: () => void;
}) {
  const bt = agent.backtest;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <section className={`card p-5 ${agent.status === "killed" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agent/12" aria-hidden>
            <Icon.Analyst className="h-4.5 w-4.5 text-agent" />
          </span>
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

      <p className="mt-3 break-words text-xs leading-relaxed text-ink-3">{agent.thesis}</p>

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
      <div className="tnum mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
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
