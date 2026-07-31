"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usd, pct, displaySymbol, marketHrefFor } from "@/components/trading/shared";

/*
  The journal (gap 30) — every closed trade and every event the desk imposed
  on you, each with the sentence explaining what happened and why.

  This is the platform's most valuable writing: the margin call that says the
  desk closed your position and not you, the dividend that explains the
  ex-date gap, the assignment that describes the writer's side. It lived in a
  tab of the market-page tray, reachable only while looking at one symbol.
  Now it is a place you can go.
*/

type Entry = {
  id: string; symbol: string; side: string; qty: number;
  entryPrice: number; exitPrice: number; pnl: number | null;
  thesis: string | null; agentId: string | null; createdAt: number;
};
type Summary = { trades: number; realized: number; winRate: number | null; events: number };

/* Events carry a lesson; trades carry a number. Both belong here, but they
   read differently, so they're marked differently. */
const SIDE_LABEL: Record<string, string> = {
  sell: "Closed", cover: "Covered", expired: "Expired", exercised: "Exercised",
  assigned: "Assigned", dividend: "Dividend", "margin-call": "Margin call",
};
const SIDE_TONE: Record<string, string> = {
  sell: "text-ink-2", cover: "text-ink-2", expired: "text-ink-3",
  exercised: "text-gold", assigned: "text-warning", dividend: "text-gain",
  "margin-call": "text-loss",
};

type Filter = "all" | "trades" | "events";

export default function JournalView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/journal");
      if (!res.ok) { setPhase("error"); return; }
      const data = await res.json();
      if (!data.ok) { setPhase("error"); return; }
      setEntries(data.entries);
      setSummary(data.summary);
      setPhase("ready");
    } catch { setPhase("error"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const isTrade = (e: Entry) => e.side === "sell" || e.side === "cover";
    if (filter === "trades") return entries.filter(isTrade);
    if (filter === "events") return entries.filter((e) => !isTrade(e));
    return entries;
  }, [entries, filter]);

  return (
    <main className="relative isolate mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-10 md:px-8 md:pb-10">
      <div className="aura aura-gold" aria-hidden />
      <div className="relative z-10 rise-in">
        <p className="kicker">The record</p>
        <h1 className="display mt-3 text-4xl text-ink-1 md:text-5xl">Your journal.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          Every position you closed and every event the desk imposed — expiries,
          assignments, dividends, margin calls — each with the reason attached.
          The numbers say what happened; the sentences say what it taught.
        </p>
      </div>

      {summary && (
        <section className="raised relative z-10 mt-8 flex flex-wrap gap-x-10 gap-y-3 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Realized</p>
            <p className={`tnum mt-0.5 text-xl font-semibold ${
              summary.realized > 0 ? "text-gain" : summary.realized < 0 ? "text-loss" : "text-ink-2"
            }`}>
              {summary.realized >= 0 ? "+" : ""}{usd(summary.realized)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Closed trades</p>
            <p className="tnum mt-0.5 text-xl font-semibold text-ink-1">{summary.trades}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Win rate</p>
            <p className="tnum mt-0.5 text-xl font-semibold text-ink-1">
              {summary.winRate == null ? "—" : pct(summary.winRate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Desk events</p>
            <p className="tnum mt-0.5 text-xl font-semibold text-ink-1">{summary.events}</p>
          </div>
        </section>
      )}

      <div className="relative z-10 mt-6 flex gap-1">
        {(["all", "trades", "events"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`pressable min-h-10 rounded-full px-4 text-xs capitalize transition-colors ${
              filter === f ? "bg-gold/15 text-gold" : "text-ink-4 hover:text-ink-2"
            }`}>
            {f}
          </button>
        ))}
      </div>

      <section className="raised relative z-10 mt-4 overflow-hidden">
        {phase === "loading" && <div className="skeleton m-4 h-40" />}
        {phase === "error" && (
          <p className="px-5 py-10 text-center text-sm text-loss">
            Couldn&apos;t load the journal. Refresh to retry.
          </p>
        )}
        {phase === "ready" && shown.length === 0 && (
          <p className="px-5 py-14 text-center text-sm text-ink-3">
            Nothing recorded yet. Close a position and the first entry writes itself.
          </p>
        )}
        <ul className="divide-y divide-[var(--hairline)]">
          {shown.map((e) => (
            <li key={e.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-1">
                  <Link href={marketHrefFor(e.symbol)} className="pressable hover:text-gold">
                    {displaySymbol(e.symbol)}
                  </Link>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${SIDE_TONE[e.side] ?? "text-ink-4"}`}>
                    {SIDE_LABEL[e.side] ?? e.side}
                  </span>
                  {e.agentId && (
                    <span className="rounded-full bg-agent/12 px-2 py-0.5 text-[10px] text-agent">analyst</span>
                  )}
                </p>
                <p className={`tnum text-sm font-semibold ${
                  (e.pnl ?? 0) > 0 ? "text-gain" : (e.pnl ?? 0) < 0 ? "text-loss" : "text-ink-3"
                }`}>
                  {(e.pnl ?? 0) >= 0 ? "+" : ""}{usd(e.pnl ?? 0)}
                </p>
              </div>
              <p className="tnum mt-1 text-[11px] text-ink-4">
                {e.qty} @ {usd(e.entryPrice)} → {usd(e.exitPrice)}
                {" · "}
                {new Date(e.createdAt).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </p>
              {e.thesis && (
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-3">{e.thesis}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
