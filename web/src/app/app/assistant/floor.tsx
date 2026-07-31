"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HoldButton from "@/components/hold-button";
import AssistantChat from "@/components/assistant-chat";
import LearnLink from "@/components/academy/learn-link";
import { AnalystSigil } from "@/components/analyst-sigil";

/*
  The analyst floor — your desk of automated traders, run by conversation or
  by one click from the bench.

  Three ways in, for three kinds of people:
  - The bench: six pre-tuned archetypes with the discipline already installed.
    Hire in one click, backtest in one more. No jargon required.
  - The conversation: tell the assistant what you want in plain English.
  - The rule engine underneath: for the person who wants to see every gear.

  Nothing here promises profit. The 70/30 backtest is the resume, the
  out-of-sample number is the interview, and the activity feed narrates every
  decision after the fact. The kill switch never needs anyone's permission.
*/

type IndicatorRef =
  | { kind: "price" } | { kind: "sma"; period: number }
  | { kind: "ema"; period: number } | { kind: "rsi"; period: number }
  | { kind: "roc"; period: number }
  | { kind: "bollUpper"; period: number } | { kind: "bollLower"; period: number }
  | { kind: "highest"; period: number } | { kind: "lowest"; period: number }
  | { kind: "constant"; value: number };
type Rule = { lhs: IndicatorRef; comparator: string; rhs: IndicatorRef };
type Strategy = {
  universe: string[]; entry: Rule[]; exit: Rule[];
  risk?: { stopLoss?: number; takeProfit?: number; cooldownBars?: number };
};
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
type BenchSeat = {
  key: string; name: string; sigil: string; creed: string; method: string;
  allocation: number; maxDrawdown: number;
};
type Activity = { id: string; agentName: string; text: string; createdAt: number };

const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pctf = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function AnalystFloor() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bench, setBench] = useState<BenchSeat[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      setAgents(data.agents);
      setActivity(data.activity);
      if (Array.isArray(data.bench)) setBench(data.bench);
    }
  }, []);

  useEffect(() => {
    load();
    // The desk tick fires app-wide from AppNav; here we just refresh the view.
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, 15_000);
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

  async function floorAction(action: "pauseAll" | "resumeAll") {
    setBusy(action); setError(null);
    await fetch("/api/agents", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    load();
  }

  async function hirePreset(key: string) {
    setBusy(`bench:${key}`); setError(null);
    const res = await fetch("/api/agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: key }),
    });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "Couldn't hire from the bench.");
    setBusy(null);
    load();
  }

  const floor = useMemo(() => {
    const active = agents.filter((a) => a.status === "running");
    /*
      Floor P&L counts the LIVE book (gap 27). Folding retired analysts in
      forever mixed a closed history into a running number: a floor that was
      up today could read down because something killed last month is still
      in the total. Retired P&L is real and worth seeing — it belongs in a
      lifetime figure, shown separately, not blended into "the floor".
    */
    const live = agents.filter((a) => a.status === "running" || a.status === "paused");
    const retired = agents.filter((a) => a.status === "killed");
    return {
      running: active.length,
      paused: agents.filter((a) => a.status === "paused").length,
      allocated: active.reduce((s, a) => s + a.allocation, 0),
      pnl: live.reduce((s, a) => s + a.pnl, 0),
      retiredPnl: retired.reduce((s, a) => s + a.pnl, 0),
      retiredCount: retired.length,
    };
  }, [agents]);

  const hiredNames = useMemo(() => new Set(agents.map((a) => a.name)), [agents]);

  return (
    <main className="relative isolate mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-5 pb-24 pt-10 md:pb-10 md:px-8">
      {/* the analyst floor's ambient — violet is the agent domain */}
      <div className="aura aura-agent" aria-hidden />
      <span aria-hidden className="ghost pointer-events-none absolute -top-4 right-0 select-none text-[26vw] leading-none md:text-[13rem]">
        DESK
      </span>
      <div className="relative z-10 rise-in">
        <div className="mb-3 flex items-center gap-3">
          <p className="kicker">The assistant</p>
          <LearnLink concept="ai" />
        </div>
        <h1 className="display text-4xl text-ink-1 md:text-5xl">Your floor of analysts.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          Automated traders that work while you don&apos;t — hired from the bench in
          one click or built in plain English with your assistant. Every one is
          transparent rules plus installed discipline: stops, cooldowns, an
          honest backtest before any allocation, and a kill switch that is
          always yours.
        </p>
      </div>

      {/* ---- floor summary: the desk at a glance + the master switches ---- */}
      <section className="raised relative z-10 mt-8 overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-agent/50 to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">On the floor</p>
              <p className="tnum mt-0.5 text-xl font-semibold text-ink-1">
                {floor.running}
                <span className="ml-1.5 text-xs font-normal text-ink-4">
                  running{floor.paused > 0 ? ` · ${floor.paused} paused` : ""}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Allocated</p>
              <p className="tnum mt-0.5 text-xl font-semibold text-ink-1">{usd(floor.allocated)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Floor P&amp;L</p>
              <p className={`tnum mt-0.5 text-xl font-semibold ${floor.pnl > 0 ? "text-gain" : floor.pnl < 0 ? "text-loss" : "text-ink-2"}`}>
                {floor.pnl >= 0 ? "+" : ""}{usd(floor.pnl)}
              </p>
              {floor.retiredCount > 0 && (
                <p className="tnum text-[10px] text-ink-4">
                  {floor.retiredPnl >= 0 ? "+" : ""}{usd(floor.retiredPnl)} from {floor.retiredCount} retired
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {floor.running > 0 && (
              <button disabled={busy === "pauseAll"} onClick={() => floorAction("pauseAll")}
                className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-1 hover:border-ink-4 disabled:opacity-50">
                Pause the floor
              </button>
            )}
            {floor.paused > 0 && (
              <button disabled={busy === "resumeAll"} onClick={() => floorAction("resumeAll")}
                className="pressable rounded-full bg-agent/15 px-4 py-2 text-xs font-semibold text-agent disabled:opacity-50">
                Resume the floor
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-loss">
          {error}
        </p>
      )}

      {/* ---- the bench: archetypes anyone can hire in one click ---- */}
      <section className="relative z-10 mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">The bench</h2>
          <p className="text-[11px] text-ink-4">Pre-tuned archetypes — discipline included, backtest still required</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bench.map((seat) => {
            const hired = hiredNames.has(seat.name);
            return (
              <article key={seat.key}
                className="raised lift group relative overflow-hidden p-4">
                <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-agent/10 blur-2xl transition-opacity duration-300 opacity-0 group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-agent/12 text-agent ring-1 ring-inset ring-agent/25">
                    <AnalystSigil sigil={seat.sigil} className="h-5.5 w-5.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-1">{seat.name}</p>
                    <p className="tnum text-[10px] text-ink-4">
                      {usd(seat.allocation)} · halts at −{pctf(seat.maxDrawdown)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs italic leading-relaxed text-ink-2">&ldquo;{seat.creed}&rdquo;</p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-4">{seat.method}</p>
                <button disabled={busy === `bench:${seat.key}` || hired}
                  onClick={() => hirePreset(seat.key)}
                  className="pressable mt-3 w-full rounded-full bg-agent/15 py-2 text-xs font-semibold text-agent transition-colors hover:bg-agent/22 disabled:opacity-45">
                  {hired ? "On your floor" : busy === `bench:${seat.key}` ? "Hiring…" : "Hire"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="relative z-10 mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* The conversation IS the builder. */}
        <AssistantChat onDeskChanged={load} />

        {/* The roster — audit view + hard controls. */}
        <div className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
          {agents.length === 0 && (
            <section className="raised flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p className="text-sm text-ink-2">The floor is empty.</p>
              <p className="max-w-sm text-xs text-ink-4">
                Hire from the bench above, or ask your assistant for one — a
                single symbol, a simple idea, smallest allocation. Watch it work
                for a week before giving it a raise.
              </p>
            </section>
          )}
          {agents.map((agent) => (
            <AnalystCard key={agent.id} agent={agent} busy={busy === agent.id}
              onAction={(a) => act(agent.id, a)} onDelete={() => remove(agent.id)} />
          ))}
        </div>
      </div>

      <section className="raised relative z-10 mt-8 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3">
          <span className="text-agent"><AnalystSigil sigil="custom" className="h-4 w-4" /></span>
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

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-ink-4">
        Analysts trade stocks, ETFs and crypto. FX and futures are deliberately
        out of reach — the rule engine can&apos;t roll a contract or reason about a
        currency pair&apos;s quote currency, and an analyst that mis-sizes those is
        worse than one that declines them. Trade those yourself from their
        market pages.
      </p>
      <p className="mt-3 text-center text-xs text-ink-4">
        Your analysts trade simulated capital only. Every order is tagged and
        auditable, backtests are honest by construction, and nothing on this
        floor promises a profit — it shows you its work instead.
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
  const running = agent.status === "running";
  return (
    <section className={`raised lift rise-in relative overflow-hidden p-5 ${agent.status === "killed" ? "opacity-70" : ""}`}>
      {/* a running analyst wears a live thread along its top edge */}
      {running && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-agent/60 to-transparent" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-agent ring-1 ring-inset ${
            running ? "bg-agent/16 ring-agent/40 shadow-[0_0_18px_-4px_var(--agent)]" : "bg-agent/10 ring-agent/20"
          }`} aria-hidden>
            <AnalystSigil sigil={agent.emoji} className="h-5.5 w-5.5" />
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
          {running && <span className="pulse-ring mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gain align-middle" />}
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
        <defs>
          <linearGradient id={`bt-fill-${splitX.toFixed(0)}-${curve.length}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--agent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--agent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#bt-fill-${splitX.toFixed(0)}-${curve.length})`} stroke="none" />
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
