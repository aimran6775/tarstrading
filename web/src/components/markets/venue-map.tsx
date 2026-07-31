"use client";

import Link from "next/link";
import { pct, displaySymbol, type BoardEntry, type MarketCategory } from "@/components/trading/shared";
import type { BoardRow } from "./board-types";

/*
  The venue map — the "everything you can trade here" moment.

  The rooms always existed as pills, but a pill row communicates navigation,
  not breadth: nothing on the page said "this desk carries ~1,700 markets
  across eight venues, plus options and private funds." Each tile names a
  venue, counts its listings from the curated board (the real number, not the
  loaded page), describes it in one line, and shows the venue's current
  leader when the headline board has one. Tap a tile, enter the room.

  Options and Alternatives close the set: one lives on every stock page, the
  other has its own wing, and both deserve a door here even though neither is
  a board section.
*/

const GLYPH: Record<string, React.ReactNode> = {
  Stocks: <path d="M7 14v4M7 10v2M12 6v12M12 4v0M17 9v6M17 17v1" />,
  ETFs: <path d="M12 4l8 4-8 4-8-4 8-4ZM4 12l8 4 8-4M4 16l8 4 8-4" />,
  Crypto: <path d="M12 3l7 4v8l-7 4-7-4V7l7-4ZM12 8v8M9 10l6 4M15 10l-6 4" />,
  Global: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9s1.3-6.5 3.8-9Z" />,
  FX: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  Income: <path d="M6 18l12-12M8 7a1.5 1.5 0 1 0 0 .01M16 17a1.5 1.5 0 1 0 0 .01" />,
  Indices: <path d="M4 17l4-5 3 3 5-7 4 4" />,
  Futures: <path d="M5 8h14M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8ZM9 4v3M15 4v3M10 14l2 2 4-4" />,
  Options: <path d="M5 12h5M14 12h5M10 12c2-.2 2-5 4-5M10 12c2 .2 2 5 4 5M19 7a0 0 0 1 0 0 .01M19 17a0 0 0 1 0 0 .01" />,
  Alternatives: <path d="M5 10V8a7 7 0 0 1 14 0v2M4 10h16v9H4v-9ZM12 14v2" />,
};

const VENUES: { cat: MarketCategory; blurb: string }[] = [
  { cat: "Stocks", blurb: "Own a piece of a company." },
  { cat: "ETFs", blurb: "Sectors, factors and leverage in one share." },
  { cat: "Crypto", blurb: "Spot pairs, live around the clock." },
  { cat: "Global", blurb: "ADRs and country funds — the world on one exchange." },
  { cat: "FX", blurb: "Spot currency pairs at daily ECB rates." },
  { cat: "Income", blurb: "Preferreds, closed-end funds, bond vehicles." },
  { cat: "Indices", blurb: "The benchmarks — quote-only; trade via futures or ETFs." },
  { cat: "Futures", blurb: "Margin-traded contracts: index, energy, metals, rates." },
];

function Glyph({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {GLYPH[name]}
    </svg>
  );
}

export default function VenueMap({ board, rows, onSelect }: {
  board: BoardEntry[];
  rows: BoardRow[];
  onSelect: (cat: MarketCategory) => void;
}) {
  const counts = new Map<string, number>();
  for (const b of board) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);

  /** The venue's loudest market right now, when the headline page carries it. */
  const leaderOf = (cat: MarketCategory) => {
    let best: BoardRow | null = null;
    for (const r of rows) {
      if (r.category !== cat || r.changePercent == null) continue;
      if (!best || Math.abs(r.changePercent) > Math.abs(best.changePercent!)) best = r;
    }
    return best;
  };

  const tile =
    "group flex w-[196px] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border border-hairline " +
    "bg-bg1 p-3.5 text-left transition-colors hover:border-gold/35 hover:bg-bg2";

  return (
    <section aria-label="Everything you can trade" className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
          The whole desk
        </h2>
        <p className="tnum text-[10px] text-ink-4">
          {board.length.toLocaleString()} listed markets
        </p>
      </div>
      <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden">
        {VENUES.map(({ cat, blurb }) => {
          const leader = leaderOf(cat);
          return (
            <button key={cat} type="button" onClick={() => onSelect(cat)} className={`pressable ${tile}`}>
              <span className="flex items-center justify-between text-ink-3 transition-colors group-hover:text-gold">
                <Glyph name={cat} />
                <span className="tnum text-[10px] text-ink-4">{counts.get(cat) ?? 0}</span>
              </span>
              <span className="text-sm font-semibold text-ink-1">{cat}</span>
              <span className="min-h-8 text-[11px] leading-snug text-ink-3">{blurb}</span>
              {leader ? (
                <span className="tnum flex items-center gap-1.5 text-[10px] text-ink-4">
                  <span className="font-mono text-ink-3">{displaySymbol(leader.symbol)}</span>
                  <span className={leader.changePercent! >= 0 ? "text-gain" : "text-loss"}>
                    {pct(leader.changePercent!)}
                  </span>
                </span>
              ) : <span className="min-h-[15px]" aria-hidden />}
            </button>
          );
        })}

        {/* The two doors that aren't board sections. */}
        <Link href="/app/m/AAPL" className={`${tile} pressable no-underline`}>
          <span className="flex items-center justify-between text-ink-3 transition-colors group-hover:text-gold">
            <Glyph name="Options" />
          </span>
          <span className="text-sm font-semibold text-ink-1">Options</span>
          <span className="min-h-8 text-[11px] leading-snug text-ink-3">
            Calls and puts — the chain lives on every stock page.
          </span>
          <span className="text-[10px] text-gold">Open a chain</span>
        </Link>
        <Link href="/app/alternatives" className={`${tile} pressable no-underline`}>
          <span className="flex items-center justify-between text-ink-3 transition-colors group-hover:text-gold">
            <Glyph name="Alternatives" />
          </span>
          <span className="text-sm font-semibold text-ink-1">Alternatives</span>
          <span className="min-h-8 text-[11px] leading-snug text-ink-3">
            Private funds and the J-curve, simulated end to end.
          </span>
          <span className="text-[10px] text-gold">Enter the wing</span>
        </Link>
      </div>
    </section>
  );
}
