"use client";

import { GLOSS, money, multiple, irrText, type Metrics } from "./types";

/*
  The allocator's headline. Two rows, because they are two different kinds of
  fact: what capital has DONE (committed / called / distributed / NAV /
  unfunded), and what it has EARNED per dollar actually paid in (TVPI / DPI /
  RVPI / IRR).

  Every tile carries its own definition. These acronyms are the price of
  admission to this asset class, and a desk that shows "DPI 0.42×" without
  saying what DPI is has taught nothing.
*/

function Tile({ label, value, gloss, tone = "plain", wide = false }: {
  label: string;
  value: string;
  gloss: string;
  tone?: "plain" | "gold" | "gain" | "loss";
  wide?: boolean;
}) {
  const valueTone =
    tone === "gold" ? "text-gold" : tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-1";
  return (
    <div className={`raised flex flex-col p-4 ${tone === "gold" ? "ring-1 ring-gold/25" : ""} ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-4">{label}</p>
      <p className={`tnum mt-1.5 text-xl font-semibold leading-none ${valueTone}`}>{value}</p>
      <p className="mt-2.5 text-[11px] leading-relaxed text-ink-3">{gloss}</p>
    </div>
  );
}

export default function PortfolioSummary({ totals, equity, commitments }: {
  totals: Metrics;
  equity: number;
  commitments: number;
}) {
  const empty = commitments === 0;

  return (
    <section aria-labelledby="book-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="book-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
          The book
        </h2>
        <p className="tnum text-[11px] text-ink-4">
          {commitments} commitment{commitments === 1 ? "" : "s"} · {money(equity)} of equity behind them
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Committed" value={money(totals.committed)} gloss={GLOSS.committed} />
        <Tile label="Called" value={money(totals.called)} gloss={GLOSS.called} />
        <Tile label="Distributed" value={money(totals.distributed)} gloss={GLOSS.distributed} />
        <Tile label="Net asset value" value={money(totals.nav)} gloss={GLOSS.nav} />
        <Tile label="Unfunded" value={money(totals.unfunded)} gloss={GLOSS.unfunded} tone="gold" />
      </div>

      {!empty && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="TVPI" value={multiple(totals.tvpi, totals.called)} gloss={GLOSS.tvpi} />
          <Tile label="DPI" value={multiple(totals.dpi, totals.called)} gloss={GLOSS.dpi} />
          <Tile label="RVPI" value={multiple(totals.rvpi, totals.called)} gloss={GLOSS.rvpi} />
          <Tile
            label="Net IRR"
            value={irrText(totals.irr)}
            gloss={GLOSS.irr}
            tone={totals.irr == null ? "plain" : totals.irr >= 0 ? "gain" : "loss"}
          />
        </div>
      )}

      {totals.unfunded > 0 && (
        <p className="rounded-[10px] border border-gold/25 bg-gold/[0.06] px-4 py-3 text-[12px] leading-relaxed text-ink-2">
          <span className="font-medium text-gold">You still owe {money(totals.unfunded)}.</span>{" "}
          Managers call it when they find something to buy — typically ten days&apos; notice, and you don&apos;t
          get to say no. Keep enough liquid to answer every call, or your stake gets written down.
        </p>
      )}
    </section>
  );
}
