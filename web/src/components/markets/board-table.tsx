"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RangeMeter } from "./range-meter";
import { instrumentOf } from "./instrument";
import { displaySymbol } from "@/components/trading/shared";
import {
  DASH, compact, marketPath, money, pctOf, positionIn, signedMoney, toneOf, type BoardRow,
} from "./board-types";

/*
  The board table — the centerpiece. Every curated market, one dense row each:
  last, change, volume, both ranges as instruments, and trailing returns.

  A world board holds instruments that look alike and behave nothing alike, so
  each symbol carries its nature underneath it — ADR, country fund, preferred,
  FX pair — and prints in its own units: dollars for a security, pips and no
  currency mark for a currency pair. FX rides on its real ticker (FX:EURUSD)
  in every link; only the reader sees EUR/USD.

  Sorting is client-side over the polled snapshot; nulls always sink to the
  bottom whichever direction is active, because "unknown" is not "smallest".
  The table owns its own scroll box — the page never scrolls sideways — and
  keeps the symbol column and the header pinned while you travel through it.
*/

type SortKey =
  | "symbol" | "price" | "change" | "changePercent" | "volume"
  | "dayRange" | "rangePosition" | "return1M" | "return1Y";

type Dir = "asc" | "desc";

type Column = {
  key: SortKey;
  label: string;
  /** Longer label for the header tooltip / screen readers. */
  full?: string;
  numeric: boolean;
  width: string;
};

const COLUMNS: Column[] = [
  { key: "symbol", label: "Symbol", numeric: false, width: "w-[128px]" },
  { key: "price", label: "Last", numeric: true, width: "w-[104px]" },
  { key: "change", label: "Chg", numeric: true, width: "w-[96px]" },
  { key: "changePercent", label: "Chg%", numeric: true, width: "w-[86px]" },
  { key: "volume", label: "Volume", numeric: true, width: "w-[92px]" },
  { key: "dayRange", label: "Day range", full: "Position in the day's range", numeric: true, width: "w-[128px]" },
  { key: "rangePosition", label: "52w range", full: "Position in the 52-week range", numeric: true, width: "w-[128px]" },
  { key: "return1M", label: "1M", full: "One-month return", numeric: true, width: "w-[80px]" },
  { key: "return1Y", label: "1Y", full: "One-year return", numeric: true, width: "w-[80px]" },
];

function sortValue(r: BoardRow, key: SortKey): number | string | null {
  switch (key) {
    // Sort by what's on screen: EUR/USD files under E, not under its FX: prefix.
    case "symbol": return displaySymbol(r.symbol);
    case "dayRange": return positionIn(r.dayLow, r.dayHigh, r.price);
    case "rangePosition": return r.rangePosition;
    default: return r[key];
  }
}

/** An up/down chevron pair; the active direction is inked, the other ghosted. */
function SortMark({ active, dir }: { active: boolean; dir: Dir }) {
  return (
    <svg viewBox="0 0 10 12" className={`h-2.5 w-2.5 shrink-0 ${active ? "text-gold" : "text-ink-4 opacity-0 group-hover/th:opacity-60"}`}
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {active && dir === "asc"
        ? <path d="M2 7.5 L5 4 L8 7.5" />
        : <path d="M2 4.5 L5 8 L8 4.5" />}
    </svg>
  );
}

export default function BoardTable({ rows, loading, emptyNote, names, onRemove }: {
  rows: BoardRow[];
  loading: boolean;
  emptyNote: string;
  /** Registered names, where the page knows them — they sharpen the type label. */
  names?: Map<string, string>;
  /** Present only in the watchlist view — renders a trailing remove control. */
  onRemove?: (symbol: string) => void;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("changePercent");
  const [dir, setDir] = useState<Dir>("desc");

  function toggle(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir(key === "symbol" ? "asc" : "desc"); }
  }

  const sorted = useMemo(() => {
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va ?? "").localeCompare(String(vb ?? "")) * sign;
      }
      // Unknown sinks in both directions — a dash is not a small number.
      if (va == null && vb == null) return a.symbol.localeCompare(b.symbol);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va === vb) return a.symbol.localeCompare(b.symbol);
      return (va - vb) * sign;
    });
  }, [rows, sortKey, dir]);

  // The header's rule is an inset shadow, not a border: a collapsed border on a
  // sticky cell detaches from it while the body scrolls under.
  const headCell = "sticky top-0 bg-bg1 shadow-[inset_0_-1px_0_var(--hairline)] px-2.5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4";

  return (
    <div className="raised overflow-hidden">
      <div className="max-h-[min(72vh,860px)] overflow-auto overscroll-contain">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <caption className="sr-only">
            Market board — {sorted.length} markets, sorted by {COLUMNS.find((c) => c.key === sortKey)?.label} {dir === "asc" ? "ascending" : "descending"}
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((c, i) => {
                const active = c.key === sortKey;
                return (
                  <th key={c.key} scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`${headCell} ${c.width} ${i === 0 ? "left-0 z-30" : "z-20"} ${c.numeric ? "text-right" : "text-left"}`}>
                    <button type="button" onClick={() => toggle(c.key)} title={c.full ?? c.label}
                      className={`group/th flex w-full items-center gap-1 whitespace-nowrap transition-colors hover:text-ink-1 ${
                        active ? "text-ink-1" : ""
                      } ${c.numeric ? "justify-end" : "justify-start"}`}>
                      {c.label}
                      <SortMark active={active} dir={dir} />
                    </button>
                  </th>
                );
              })}
              {onRemove && <th scope="col" className={`${headCell} z-20 w-[52px] text-right`}><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>

          <tbody>
            {loading && sorted.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <tr key={`s${i}`} className="border-t border-hairline">
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-2.5 py-2.5">
                    <span className={`skeleton block h-3 ${c.numeric ? "ml-auto w-16" : "w-20"}`} />
                  </td>
                ))}
                {onRemove && <td />}
              </tr>
            ))}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + (onRemove ? 1 : 0)}
                  className="px-4 py-14 text-center text-sm text-ink-4">
                  {emptyNote}
                </td>
              </tr>
            )}

            {sorted.map((r) => {
              const dayPos = positionIn(r.dayLow, r.dayHigh, r.price);
              const shown = displaySymbol(r.symbol);
              const kind = instrumentOf(r.symbol, r.category, names?.get(r.symbol));
              return (
                <tr key={r.symbol}
                  onClick={() => router.push(marketPath(r.symbol))}
                  className="group cursor-pointer border-t border-hairline transition-colors hover:bg-bg2">
                  <td className="sticky left-0 z-10 bg-bg1 px-2.5 py-0 transition-colors group-hover:bg-bg2">
                    <Link href={marketPath(r.symbol)} onClick={(e) => e.stopPropagation()}
                      className="flex h-11 flex-col justify-center md:h-10">
                      <span className="truncate text-[13px] font-semibold tracking-tight text-ink-1 group-hover:text-gold">
                        {shown}
                      </span>
                      <span title={kind.title}
                        className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-ink-4">
                        {kind.label}
                      </span>
                    </Link>
                  </td>
                  <td className="tnum px-2.5 text-right text-[13px] text-ink-1">{money(r.price, r.symbol)}</td>
                  <td className={`tnum px-2.5 text-right text-[12px] ${toneOf(r.change)}`}>{signedMoney(r.change, r.symbol)}</td>
                  <td className={`tnum px-2.5 text-right text-[12px] font-semibold ${toneOf(r.changePercent)}`}>
                    {pctOf(r.changePercent)}
                  </td>
                  <td className="tnum px-2.5 text-right text-[12px] text-ink-2">{compact(r.volume)}</td>
                  <td className="px-2.5">
                    <span className="flex justify-end">
                      <RangeMeter position={dayPos} low={r.dayLow} high={r.dayHigh} symbol={r.symbol}
                        label="Day range" className="w-[104px]" />
                    </span>
                  </td>
                  <td className="px-2.5">
                    <span className="flex justify-end">
                      <RangeMeter position={r.rangePosition} low={r.low52} high={r.high52} symbol={r.symbol}
                        label="52-week range" className="w-[104px]" />
                    </span>
                  </td>
                  <td className={`tnum px-2.5 text-right text-[12px] ${toneOf(r.return1M)}`}>
                    {r.return1M == null ? DASH : pctOf(r.return1M)}
                  </td>
                  <td className={`tnum px-2.5 text-right text-[12px] ${toneOf(r.return1Y)}`}>
                    {r.return1Y == null ? DASH : pctOf(r.return1Y)}
                  </td>
                  {onRemove && (
                    <td className="px-1 text-right">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); onRemove(r.symbol); }}
                        aria-label={`Remove ${shown} from watchlist`}
                        className="pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-4 hover:text-loss md:h-9 md:w-9">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" aria-hidden>
                          <path d="M6 6 L18 18 M18 6 L6 18" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
