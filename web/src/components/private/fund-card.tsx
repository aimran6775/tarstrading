"use client";

import { useState } from "react";
import HoldButton from "@/components/hold-button";
import { Icon } from "@/components/icons";
import {
  STRATEGY_LABEL, STRATEGY_NOTE, money, type Fund,
} from "./types";

/*
  An open fund, and the act of committing to it.

  The commit form's whole job is to make one thing unmistakable: you are
  signing a promise, not making a purchase. No cash moves today. The money
  leaves later, on someone else's schedule, and the headroom meter shows what
  you'd have left to answer those calls with.

  The API's 422s are the teaching moments — below the minimum, or promising
  more than your equity can honestly fund — so they're surfaced verbatim and
  in place rather than swallowed into a generic failure.
*/

type Phase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "done"; amount: number };

export default function FundCard({ fund, equity, outstanding, open, onOpen, onCommitted }: {
  fund: Fund;
  /** Account equity — the ceiling every unfunded promise is measured against. */
  equity: number;
  /** Unfunded capital already promised to other funds. */
  outstanding: number;
  open: boolean;
  onOpen: (id: string | null) => void;
  onCommitted: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const headroom = Math.max(0, equity - outstanding);
  const value = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const belowMin = value > 0 && value < fund.minCommitment;
  const overCommit = value > headroom;
  const valid = value > 0 && !belowMin && !overCommit;
  const unfundedAfter = outstanding + value;

  const strategy = STRATEGY_LABEL[fund.strategy] ?? fund.strategy;
  const presets = [fund.minCommitment, fund.minCommitment * 2, fund.minCommitment * 4]
    .filter((p, i) => i === 0 || p <= headroom);

  async function submit() {
    if (!valid || phase.kind === "sending") return;
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: fund.id, amount: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPhase({ kind: "done", amount: value });
        setAmount("");
        onCommitted();
      } else {
        setPhase({ kind: "error", message: data?.error ?? "That commitment didn't go through." });
      }
    } catch {
      setPhase({ kind: "error", message: "Couldn't reach the desk. Nothing was committed — try again." });
    }
  }

  function toggle() {
    setPhase({ kind: "idle" });
    onOpen(open ? null : fund.id);
  }

  return (
    <article className={`raised flex flex-col p-5 transition-shadow ${open ? "ring-1 ring-gold/25" : "lift"}`}>
      <header>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug text-ink-1">{fund.name}</h3>
          <span className="shrink-0 rounded-full border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {strategy}
          </span>
        </div>
        <p className="tnum mt-2 text-[11px] text-ink-4">
          Vintage {fund.vintage} · {fund.termYears}-year term · minimum {money(fund.minCommitment)}
        </p>
      </header>

      <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-2">{fund.blurb}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-4">{STRATEGY_NOTE[fund.strategy]}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-[11px]">
        <div title="Charged every year on your commitment during the investment period — this is the fee that digs the J-curve.">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-4">Mgmt fee</dt>
          <dd className="tnum mt-0.5 text-ink-1">{(fund.mgmtFee * 100).toFixed(fund.mgmtFee * 100 % 1 ? 2 : 0)}%</dd>
        </div>
        <div title="The manager's share of the profit, taken only above the preferred return.">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-4">Carry</dt>
          <dd className="tnum mt-0.5 text-ink-1">{(fund.carry * 100).toFixed(fund.carry * 100 % 1 ? 1 : 0)}%</dd>
        </div>
        <div title="The preferred return you earn before the manager takes any carry.">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-ink-4">Pref</dt>
          <dd className="tnum mt-0.5 text-ink-1">
            {fund.hurdle > 0 ? `${(fund.hurdle * 100).toFixed(0)}%` : "None"}
          </dd>
        </div>
      </dl>

      {!open ? (
        <button
          type="button" onClick={toggle}
          className="pressable mt-4 min-h-11 w-full rounded-full border border-hairline-strong px-4 text-[13px] font-medium text-ink-1 hover:border-gold/50 hover:text-gold"
        >
          Commit capital
        </button>
      ) : (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-4">Commitment</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-hairline-strong bg-bg0/60 px-3 focus-within:border-gold/60">
              <span className="text-ink-4">$</span>
              <input
                autoFocus
                inputMode="numeric"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setPhase({ kind: "idle" }); }}
                placeholder={String(fund.minCommitment)}
                aria-label={`Amount to commit to ${fund.name}`}
                className="tnum min-h-11 w-full bg-transparent text-[15px] text-ink-1 outline-none placeholder:text-ink-4"
              />
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p} type="button"
                onClick={() => { setAmount(String(p)); setPhase({ kind: "idle" }); }}
                className="tnum pressable rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-3 hover:border-gold/40 hover:text-ink-1"
              >
                {money(p)}
              </button>
            ))}
          </div>

          {/* What you'd be promising, against what can honestly fund it. */}
          <div className="rounded-[10px] border border-hairline bg-bg0/50 p-3">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-ink-3">Promised after this</span>
              <span className="tnum text-ink-1">{money(unfundedAfter)} of {money(equity)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg3">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${overCommit ? "bg-loss" : "bg-gold"}`}
                style={{ width: `${equity > 0 ? Math.min(100, (unfundedAfter / equity) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-3">
              <Icon.Shield className="mt-px h-3.5 w-3.5 shrink-0 text-gold" />
              <span>
                <span className="text-ink-2">No cash moves today.</span> A commitment is a promise. The manager
                draws it down over years, and each call takes real money out of your account when it lands.
              </span>
            </p>
          </div>

          {/* Client-side guardrails phrased as the lesson, not as validation. */}
          {belowMin && (
            <p className="rounded-[10px] border border-loss/30 bg-loss/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-loss">
              Below the minimum. This fund takes commitments from {money(fund.minCommitment)} — institutional
              funds size their LP base deliberately, and small tickets cost more to administer than they earn.
            </p>
          )}
          {overCommit && !belowMin && (
            <p className="rounded-[10px] border border-loss/30 bg-loss/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-loss">
              That over-commits you. {money(outstanding)} is already promised against {money(equity)} of equity,
              leaving {money(headroom)} of room. Real allocators do over-commit on purpose, betting that
              distributions arrive before calls — and it is exactly how they get caught out.
            </p>
          )}
          {phase.kind === "error" && (
            <p role="alert" className="rounded-[10px] border border-loss/30 bg-loss/[0.08] px-3 py-2.5 text-[11px] leading-relaxed text-loss">
              {phase.message}
            </p>
          )}
          {phase.kind === "done" && (
            <p role="status" className="rounded-[10px] border border-gold/30 bg-gold/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-gold">
              Committed {money(phase.amount)}. Nothing left your account — the first capital call will.
            </p>
          )}

          <HoldButton
            label={phase.kind === "sending" ? "Committing…" : `Commit ${value > 0 ? money(value) : "capital"}`}
            holdLabel="Hold to sign…"
            disabled={!valid || phase.kind === "sending"}
            onCommit={submit}
          />
          <button
            type="button" onClick={toggle}
            className="min-h-11 w-full text-[11px] text-ink-4 hover:text-ink-2"
          >
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}
