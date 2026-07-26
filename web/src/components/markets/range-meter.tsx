import { DASH, money } from "./board-types";

/*
  A range instrument at table scale: a hairline track, a filled run up to the
  last price, a needle at the mark, and a mid tick for reference. Neutral ink
  throughout — position inside a range is structure, not P&L, so it never
  borrows the gain/loss palette.

  `position` is 0..1. Null means the range isn't real (missing high/low, or a
  flat range) and the cell falls back to an em dash rather than a fake needle.
*/
export function RangeMeter({ position, low, high, label, symbol = "", className = "w-24" }: {
  position: number | null;
  low: number | null;
  high: number | null;
  label: string;
  /** Whose range this is — so the endpoints print in the instrument's units. */
  symbol?: string;
  className?: string;
}) {
  if (position == null) {
    return <span className="tnum text-[11px] text-ink-4" aria-label={`${label} unavailable`}>{DASH}</span>;
  }
  const p = position * 100;
  return (
    <span
      className={`relative block h-1.5 rounded-full bg-bg3 ring-1 ring-inset ring-[var(--hairline)] ${className}`}
      role="img"
      title={`${label}: ${money(low, symbol)} – ${money(high, symbol)} · ${Math.round(p)}% of range`}
      aria-label={`${label} ${money(low, symbol)} to ${money(high, symbol)}, ${Math.round(p)} percent of range`}
    >
      <span aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_oklab,var(--ink-2),transparent_62%)]"
        style={{ width: `${p}%` }} />
      <span aria-hidden
        className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-[var(--hairline-strong)]"
        style={{ left: "50%" }} />
      <span aria-hidden
        className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-1 shadow-[0_0_0_1.5px_var(--bg1)]"
        style={{ left: `${p}%` }} />
    </span>
  );
}

export default RangeMeter;
