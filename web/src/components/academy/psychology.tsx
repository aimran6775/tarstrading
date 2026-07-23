"use client";

import { useState } from "react";

/*
  Psychology-stage widgets. The point of this stage is that the enemy is you —
  so the interactives make an emotional mistake visible as a number, not a
  lecture. TiltSimulator shows revenge-trading (doubling down to "win it back")
  turning a survivable rough patch into ruin. PreTradeChecklist is the ritual
  that keeps the disciplined path on rails.
*/

const START = 10_000;
const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

/* ---------- Tilt simulator: discipline vs. revenge over a losing streak ---------- */

export function TiltSimulator() {
  const [losses, setLosses] = useState(4);

  // Disciplined: risk a flat 1% of the CURRENT balance every trade.
  const disciplined = START * Math.pow(0.99, losses);
  // Revenge (martingale): risk 1% of the STARTING balance and double it after
  // every loss to "win it back". A short streak snowballs into a crater.
  const revengeLost = 100 * (Math.pow(2, losses) - 1); // 1%,2%,4%… of $10k
  const revenge = Math.max(0, START - revengeLost);

  const discPct = Math.round((disciplined / START) * 100);
  const revPct = Math.round((revenge / START) * 100);
  const nextRiskPct = Math.pow(2, losses); // what the revenge trader risks next

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-loss">Tilt simulator</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Same rough patch — <span className="tnum text-ink-1">{losses}</span> losing trade{losses === 1 ? "" : "s"} in a row —
        hits two traders. One risks a flat 1% each time. The other doubles down after every loss to win it back.
      </p>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Losing streak</span><span className="tnum text-ink-2">{losses} in a row</span>
        </span>
        <input type="range" min={1} max={6} value={losses}
          onChange={(e) => setLosses(Number(e.target.value))}
          aria-label="Length of the losing streak"
          className="mt-2 w-full accent-loss" />
      </label>

      <div className="mt-5 flex flex-col gap-4">
        <Bar label="Disciplined · flat 1% risk" value={disciplined} pct={discPct} tone="gain" note={`down ${100 - discPct}% — a scratch`} />
        <Bar label="Revenge · double after each loss" value={revenge} pct={revPct} tone="loss"
          note={revenge <= 0 ? "account wiped out" : `down ${100 - revPct}% — next bet risks ${nextRiskPct}% of the account`} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-4">
        {losses <= 2
          ? "Two losses feel identical either way — which is exactly why the habit forms. The gap only opens when the streak runs."
          : revenge <= 0
            ? "The doubling didn't lose more trades — it lost the same trades with catastrophic size. That's how a bad week becomes a blown account."
            : "Same losers, wildly different damage. The disciplined trader is annoyed; the revenge trader is in a hole they now need a miracle to climb out of."}
      </p>
    </div>
  );
}

function Bar({ label, value, pct, tone, note }: {
  label: string; value: number; pct: number; tone: "gain" | "loss"; note: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3">{label}</span>
        <span className={`tnum text-sm font-semibold ${tone === "gain" ? "text-gain" : "text-loss"}`}>{fmt(value)}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-bg3">
        <div className={`h-full rounded-full transition-[width] duration-500 ${tone === "gain" ? "bg-gain" : "bg-loss"}`}
          style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-4">{note}</p>
    </div>
  );
}

/* ---------- Pre-trade checklist: the ritual that keeps you disciplined ---------- */

const CHECKS = [
  "I can say my thesis in one sentence.",
  "I know my stop — the price that proves me wrong.",
  "My size risks 1% of the account or less.",
  "My target is at least twice my risk (2:1).",
  "I'm not trying to win back a loss right now.",
];

export function PreTradeChecklist() {
  const [ticked, setTicked] = useState<boolean[]>(() => CHECKS.map(() => false));
  const cleared = ticked.every(Boolean);
  const count = ticked.filter(Boolean).length;

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Before you click buy</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Every professional runs a checklist. Tick each one honestly — the ritual is what stops emotion from placing the order.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {CHECKS.map((c, i) => (
          <li key={i}>
            <button
              onClick={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={ticked[i]}
              className={`pressable flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                ticked[i] ? "border-gain/50 bg-gain/8 text-ink-1" : "border-hairline text-ink-2 hover:border-ink-4"
              }`}>
              <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                ticked[i] ? "border-transparent bg-gain text-ongain" : "border-ink-4 text-transparent"
              }`}>✓</span>
              {c}
            </button>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="mt-4">
        {cleared ? (
          <p className="rounded-lg border border-gain/50 bg-gain/10 px-4 py-3 text-sm font-semibold text-gain">
            Cleared to trade. Every box is a promise you made to yourself — now the order is a decision, not a reflex.
          </p>
        ) : (
          <p className="rounded-lg border border-hairline px-4 py-3 text-sm text-ink-4">
            {count}/{CHECKS.length} checked. If you can&apos;t tick all five, the honest move is to skip the trade — not to fudge a box.
          </p>
        )}
      </div>
    </div>
  );
}
