"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { instrumentOf } from "./instrument";
import { displaySymbol, isFxSymbol } from "@/components/trading/shared";
import { compact, marketPath, money, pctOf, toneOf, type BoardRow, type Movers } from "./board-types";

/*
  Movers rails — gainers, losers and the volume leaders, three columns wide.
  The rails answer "what moved" before the table answers "what is everything
  doing". Rows are links: symbol, last, change, volume, then out to the
  symbol page.
*/

function Rail({ title, icon, rows, loading, emptyNote }: {
  title: string;
  icon: React.ReactNode;
  rows: BoardRow[];
  loading: boolean;
  emptyNote: string;
}) {
  return (
    <section className="raised flex min-w-0 flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="text-ink-4">{icon}</span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">{title}</h2>
      </header>

      {loading ? (
        <ul className="divide-y divide-[var(--hairline)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="skeleton h-3 w-14" />
              <span className="skeleton h-3 w-20" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-ink-4">{emptyNote}</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)]">
          {rows.map((r) => {
            const kind = instrumentOf(r.symbol, r.category);
            return (
              <li key={r.symbol}>
                <Link href={marketPath(r.symbol)} title={kind.title}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5 transition-colors hover:bg-bg2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold tracking-tight text-ink-1">
                      {displaySymbol(r.symbol)}
                    </span>
                    {/* Spot FX reports no share volume — the feed's count is ticks. */}
                    <span className="tnum block text-[10px] text-ink-4">
                      {compact(r.volume)} {isFxSymbol(r.symbol) ? "ticks" : "vol"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-xs text-ink-2">{money(r.price, r.symbol)}</span>
                    <span className={`tnum block text-[11px] font-semibold ${toneOf(r.changePercent)}`}>
                      {pctOf(r.changePercent)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function MoversRails({ movers, loading, take = 6 }: {
  movers: Movers | null;
  loading: boolean;
  take?: number;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Rail title="Top gainers" loading={loading} emptyNote="No advancing markets."
        icon={<Icon.Ascend className="h-3.5 w-3.5" />}
        rows={(movers?.gainers ?? []).filter((r) => (r.changePercent ?? 0) > 0).slice(0, take)} />
      <Rail title="Top losers" loading={loading} emptyNote="No declining markets."
        icon={<Icon.Ascend className="h-3.5 w-3.5 -scale-y-100" />}
        rows={(movers?.losers ?? []).filter((r) => (r.changePercent ?? 0) < 0).slice(0, take)} />
      <Rail title="Most active" loading={loading} emptyNote="No volume reported."
        icon={<Icon.Bolt className="h-3.5 w-3.5" />}
        rows={(movers?.actives ?? []).slice(0, take)} />
    </div>
  );
}
