"use client";

import JCurve from "./j-curve";
import {
  GLOSS, STATUS_LABEL, STATUS_NOTE, STRATEGY_LABEL,
  ageText, irrText, money, multiple,
  type Commitment, type Flow,
} from "./types";

/*
  One commitment, read the way an allocator reads it: what you promised, how
  much of it has actually been taken, what has come back, what is still only a
  mark — and the shape all of that has traced through the fund's life.
*/

const STATUS_DOT: Record<Commitment["status"], string> = {
  investing: "bg-ink-3",
  harvesting: "bg-gold",
  closed: "bg-ink-4",
};

function Figure({ label, value, gloss, tone = "" }: {
  label: string; value: string; gloss: string; tone?: string;
}) {
  return (
    <div title={gloss}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 text-[15px] font-semibold leading-none ${tone || "text-ink-1"}`}>{value}</p>
    </div>
  );
}

export default function CommitmentCard({ c, flows }: { c: Commitment; flows: Flow[] }) {
  const mine = flows.filter((f) => f.commitmentId === c.id);
  const recent = [...mine].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const m = c.metrics;
  const calledPct = c.committed > 0 ? Math.min(1, c.called / c.committed) : 0;
  const strategy = c.fund ? (STRATEGY_LABEL[c.fund.strategy] ?? c.fund.strategy) : "—";

  return (
    <article className="raised overflow-hidden">
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-7">
        {/* ---- the facts ---- */}
        <div className="min-w-0">
          <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-ink-1">{c.fund?.name ?? "Closed fund"}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
                <span>{strategy}</span>
                <span aria-hidden className="text-ink-4">·</span>
                <span className="tnum">Vintage {c.fund?.vintage ?? "—"}</span>
                <span aria-hidden className="text-ink-4">·</span>
                <span className="tnum">{ageText(c.age)}</span>
              </p>
            </div>
            <span
              title={STATUS_NOTE[c.status]}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2"
            >
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
              {STATUS_LABEL[c.status]}
            </span>
          </header>

          {/* called against committed — the promise, and how much of it is real */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-ink-3">
                Called <span className="tnum text-ink-1">{money(c.called)}</span> of{" "}
                <span className="tnum">{money(c.committed)}</span>
              </span>
              <span className="tnum text-ink-4">{(calledPct * 100).toFixed(0)}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg3"
              role="progressbar" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(calledPct * 100)}
              aria-label="Capital called as a share of your commitment"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-[width] duration-500"
                style={{ width: `${calledPct * 100}%` }}
              />
            </div>
            <p className="tnum mt-1.5 text-[10px] text-ink-4">
              {m.unfunded > 0.5 ? `${money(m.unfunded)} still unfunded` : "Fully drawn — nothing left to call"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Distributed" value={money(c.distributed)} gloss={GLOSS.distributed} />
            <Figure label="NAV" value={money(c.nav)} gloss={GLOSS.nav} />
            <Figure label="Unfunded" value={money(m.unfunded)} gloss={GLOSS.unfunded} tone="text-gold" />
            <Figure
              label="Net position"
              value={money(c.distributed + c.nav - c.called)}
              gloss="Distributions plus today's mark, minus everything called. Below zero means the fund is still underwater for you."
              tone={c.distributed + c.nav - c.called >= 0 ? "text-gain" : "text-loss"}
            />
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 border-t border-hairline pt-4">
            <Figure label="TVPI" value={multiple(m.tvpi, m.called)} gloss={GLOSS.tvpi} />
            <Figure label="DPI" value={multiple(m.dpi, m.called)} gloss={GLOSS.dpi} />
            <Figure label="RVPI" value={multiple(m.rvpi, m.called)} gloss={GLOSS.rvpi} />
            <Figure
              label="IRR" value={irrText(m.irr)} gloss={GLOSS.irr}
              tone={m.irr == null ? "text-ink-3" : m.irr >= 0 ? "text-gain" : "text-loss"}
            />
          </div>

          {recent.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-hairline pt-4">
              {recent.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`tnum shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${
                      f.kind === "call" ? "bg-loss/12 text-loss" : "bg-gain/12 text-gain"
                    }`}>
                      {f.kind === "call" ? "Call" : "Distribution"}
                    </span>
                    <span className="tnum truncate text-ink-4">Q{f.quarter + 1}</span>
                  </span>
                  <span className={`tnum shrink-0 ${f.kind === "call" ? "text-loss" : "text-gain"}`}>
                    {f.kind === "call" ? "−" : "+"}{money(f.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- the shape ---- */}
        <div className="min-w-0 lg:border-l lg:border-hairline lg:pl-7">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-4">J-curve</p>
          <JCurve commitment={c} flows={mine} />
        </div>
      </div>
    </article>
  );
}
