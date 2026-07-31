"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties,
} from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import AppNav from "@/components/app-nav";
import GettingStarted from "@/components/getting-started";
import SymbolInput from "@/components/symbol-input";
import MarketCard from "@/components/market-card";
import PulseStrip from "@/components/markets/pulse-strip";
import MoversRails from "@/components/markets/movers-rails";
import BoardTable from "@/components/markets/board-table";
import VenueMap from "@/components/markets/venue-map";
import { moversFromRows, type BoardPayload, type BoardRow, type Movers } from "@/components/markets/board-types";
import { fxPairName, instrumentOf } from "@/components/markets/instrument";
import { SYMBOLS } from "@/lib/symbols";
import {
  usd, pct, categoryOf, displaySymbol, formatPrice,
  type Quote, type Account, type BoardEntry, type MarketCategory,
} from "@/components/trading/shared";

/*
  Markets — the desk's front page.

  It reads top-down the way a terminal does: the pulse (index proxies +
  breadth), the featured exhibit, the movers rails, then the board itself —
  every curated market as a dense, sortable table with range instruments.
  A Table | Grid switch keeps the card view (and its sparklines) one click
  away; the choice is remembered.

  One poll drives most of it: GET /api/market/board every 20s carries prices,
  ranges, volume, returns, movers and breadth for the head of the universe.
  Opening a section (Stocks, ETFs, Crypto, Global, FX, Income) polls that same
  endpoint scoped to the section, because the world sections run hundreds deep
  and would otherwise show only what fits in the headline page. A third, much
  smaller poll covers watchlist symbols that aren't on the house board.

  The board arrives as a prop from the server (src/server/board.ts) — the
  control center's curated universe. Off-board symbols still fall back to
  shape-based classification.
*/

/* The rooms of the board. Trending is everything; Watchlist is yours; the rest
   are the platform's sections, including the world ones — Global (foreign
   companies listed here, and country funds), FX (spot currency pairs) and
   Income (preferreds, closed-end funds, bond vehicles). */
type Category = "Trending" | MarketCategory | "Watchlist";
const CATEGORIES: Category[] = [
  "Trending", "Stocks", "ETFs", "Crypto", "Global", "FX", "Income",
  "Indices", "Futures", "Watchlist",
];

/** A section is a slice of the board the server can page for us. */
type Section = MarketCategory;
const isSection = (c: Category): c is Section => c !== "Trending" && c !== "Watchlist";

/** What an empty room should say — never the same sentence twice. */
const EMPTY_NOTE: Record<Category, string> = {
  Trending: "No markets on the board yet.",
  Stocks: "No stocks on the board yet.",
  ETFs: "No funds on the board yet.",
  Crypto: "No crypto pairs on the board yet.",
  Global: "No world markets on the board yet — ADRs and country funds land here.",
  FX: "No currency pairs on the board yet.",
  Income: "No income instruments on the board yet — preferreds and bond funds land here.",
  Indices: "No index levels yet — the feeds mesh publishes them after its first daily run.",
  Futures: "No futures contracts yet — front months land here after the feeds mesh discovers them.",
  Watchlist: "Nothing on your watchlist yet. Add a ticker above and it follows you everywhere.",
};

/* One operational line per room — how this venue actually trades here. The
   venue tiles say what a thing IS; this says what happens when you buy it. */
const ROOM_NOTE: Partial<Record<Category, string>> = {
  Stocks: "Cash equities — market, limit, stop and trailing orders, long or short.",
  ETFs: "Trade like stocks, every order type works. Leveraged funds decay — visit the Academy before sizing.",
  Crypto: "Around the clock. Fills carry a 25bps commission, priced into the math.",
  Global: "Foreign companies and country funds listed in the US — dollar-priced, regular hours.",
  FX: "Spot pairs marked at daily ECB rates; P&L converts to dollars at the same rates.",
  Income: "Built for dividends — payouts land in cash automatically on pay dates.",
  Indices: "Quote-only benchmarks. To trade the level, use its future or its ETF.",
  Futures: "Post initial margin, settle variation daily. Each ticket lists its contract's $/point.",
};

const NAME = new Map(SYMBOLS.map((e) => [e.symbol, e.name]));
/** The name a row deserves: the dictionary's, or a pair spelled out. */
const nameOf = (symbol: string) => NAME.get(symbol) ?? fxPairName(symbol);
const POLL_MS = 20_000;

/* ---- the remembered view --------------------------------------------------
   Table or grid is preference state living outside React (localStorage), so
   it's read as an external store: the server snapshot is null — one frame of
   skeleton — and the client resolves to the stored choice, or to the screen's
   own default (table on a desk, grid on a phone). */

type View = "table" | "grid";
const VIEW_KEY = "tars.markets.view";

let viewCache: View | null = null;
const viewListeners = new Set<() => void>();

function readView(): View {
  if (viewCache) return viewCache;
  let saved: string | null = null;
  try { saved = window.localStorage.getItem(VIEW_KEY); } catch { /* private mode */ }
  viewCache = saved === "table" || saved === "grid"
    ? saved
    : window.matchMedia("(min-width: 768px)").matches ? "table" : "grid";
  return viewCache;
}
function writeView(v: View) {
  viewCache = v;
  try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
  viewListeners.forEach((cb) => cb());
}
function subscribeView(cb: () => void) {
  viewListeners.add(cb);
  return () => { viewListeners.delete(cb); };
}

export default function Browse({ userName, welcome, board }: {
  userName: string; welcome: boolean; board: BoardEntry[];
}) {
  const rm = useReducedMotion();
  const [category, setCategory] = useState<Category>("Trending");
  const view = useSyncExternalStore<View | null>(subscribeView, readView, () => null);
  const [account, setAccount] = useState<Account | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [sections, setSections] = useState<Partial<Record<Section, BoardRow[]>>>({});
  const [movers, setMovers] = useState<Movers | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [extraQuotes, setExtraQuotes] = useState<Map<string, Quote>>(new Map());
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [stale, setStale] = useState(false);
  const [adding, setAdding] = useState("");
  /* In-room search (client-side over the loaded rows — instant, no request).
     Cleared when the room changes: a filter that silently follows you into
     another section reads as "this room is empty". */
  const [query, setQuery] = useState("");
  const watchRef = useRef<string[]>([]);

  // The curated board, unpacked once: order, categories, featured eligibility.
  const house = useMemo(() => board.map((b) => b.symbol), [board]);
  const houseSet = useMemo(() => new Set(house), [house]);
  const boardCategory = useMemo(
    () => new Map(board.map((b) => [b.symbol, b.category] as const)),
    [board]);
  const featuredSet = useMemo(
    () => new Set(board.filter((b) => b.featured).map((b) => b.symbol)),
    [board]);
  /** Curated category first; off-board symbols fall back to the shape heuristic. */
  const categoryFor = useCallback(
    (s: string): MarketCategory => boardCategory.get(s) ?? categoryOf(s),
    [boardCategory]);

  // ------------------------------------------------------------------ loaders

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const data = await res.json();
      if (data.ok) {
        setAccount(data.account);
        setWatchlist(data.watchlist);
        watchRef.current = data.watchlist;
      }
    } catch { /* banner below covers it */ }
  }, []);

  /** The one heavy poll: the whole board with depth, movers and breadth. */
  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/market/board?limit=250");
      if (!res.ok) { setStale(true); return; }
      const data = await res.json() as BoardPayload;
      if (!data.ok || !Array.isArray(data.rows)) { setStale(true); return; }
      setRows(data.rows);
      setMovers(data.movers ?? null);
      setMarketOpen(data.marketOpen);
      setAsOf(data.asOf ?? Date.now());
      setStale(false);
    } catch { setStale(true); }
  }, []);

  /*
    One section, paged by the server.

    The headline poll takes the board's first 250 by rank, which is the right
    shape for Trending, the pulse and the movers — but the world sections are
    hundreds of symbols deep and would show only the sliver of themselves that
    reached that cut. So opening a section asks the API for that section, and
    the room fills with its own markets.
  */
  const loadSection = useCallback(async (section: Section) => {
    try {
      const res = await fetch(
        `/api/market/board?category=${encodeURIComponent(section.toLowerCase())}&limit=250`);
      if (!res.ok) { setStale(true); return; }
      const data = await res.json() as BoardPayload;
      if (!data.ok || !Array.isArray(data.rows)) { setStale(true); return; }
      setSections((prev) => ({ ...prev, [section]: data.rows }));
      setStale(false);
    } catch { setStale(true); }
  }, []);

  /** Watchlist symbols the house board doesn't carry — a much smaller ask. */
  const loadOffBoardQuotes = useCallback(async () => {
    const missing = watchRef.current.filter((s) => !houseSet.has(s)).slice(0, 24);
    if (!missing.length) return;
    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(missing.join(","))}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setExtraQuotes((prev) => {
        const next = new Map(prev);
        (data.quotes as Quote[]).forEach((q) => next.set(q.symbol, q));
        return next;
      });
    } catch { /* the board poll owns the stale banner */ }
  }, [houseSet]);

  const loadSparks = useCallback(async () => {
    const symbols = Array.from(new Set([...house, ...watchRef.current])).slice(0, 32);
    try {
      const res = await fetch(`/api/market/sparks?symbols=${encodeURIComponent(symbols.join(","))}`);
      const data = await res.json();
      if (data.ok) setSparks(data.sparks);
    } catch { /* sparklines are decoration — cards still work */ }
  }, [house]);

  useEffect(() => {
    loadAccount().then(() => { loadBoard(); loadOffBoardQuotes(); loadSparks(); });
    // A hidden tab doesn't need fresh prices — don't hammer the feed for nobody.
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadBoard(); loadOffBoardQuotes();
    };
    // …but coming back to the tab shouldn't mean staring at a stale board.
    const onVisibility = () => { if (!document.hidden) { loadBoard(); loadOffBoardQuotes(); } };
    document.addEventListener("visibilitychange", onVisibility);
    const q = setInterval(tick, POLL_MS);
    const s = setInterval(loadSparks, 5 * 60_000);
    return () => {
      clearInterval(q); clearInterval(s);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadAccount, loadBoard, loadOffBoardQuotes, loadSparks]);

  // Changing rooms drops the search — a filter that silently follows you
  // into another section reads as "this room is empty".
  useEffect(() => { setQuery(""); }, [category]);

  // The open section keeps its own beat, on the same 20s cadence.
  const openSection = isSection(category) ? category : null;
  useEffect(() => {
    if (!openSection) return;
    loadSection(openSection);
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadSection(openSection);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [openSection, loadSection]);

  // ------------------------------------------------------------- watchlist ops

  async function addToWatchlist(raw: string) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (data.ok) {
        setWatchlist(data.watchlist); watchRef.current = data.watchlist;
        setAdding(""); loadOffBoardQuotes(); loadSparks();
      }
    } catch { /* retryable */ }
  }
  const removeFromWatchlist = useCallback(async (symbol: string) => {
    await fetch("/api/watchlist", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== symbol);
      watchRef.current = next;
      return next;
    });
  }, []);

  // ------------------------------------------------------------------ derived

  const rowMap = useMemo(() => new Map(rows.map((r) => [r.symbol, r] as const)), [rows]);

  /** Quotes for the cards and the hero: board rows first, then whatever section
      is open, then off-board watchlist fills in. */
  const quotes = useMemo(() => {
    const m = new Map<string, Quote>(extraQuotes);
    const stamp = asOf ?? 0; // the loader always stamps; 0 only before the first poll
    const section = openSection ? sections[openSection] ?? [] : [];
    for (const r of [...rows, ...section]) {
      if (r.price == null || r.changePercent == null) continue;
      m.set(r.symbol, {
        symbol: r.symbol, price: r.price,
        previousClose: r.prevClose ?? r.price,
        changePercent: r.changePercent, asOf: r.asOf ?? stamp,
        provenance: r.source ?? undefined,
      });
    }
    return m;
  }, [rows, sections, openSection, extraQuotes, asOf]);

  /** A board row for any symbol — synthesised from a quote when off-board, so
      the watchlist view has a row shape even for symbols we know least about. */
  const rowFor = useCallback((symbol: string): BoardRow => {
    const hit = rowMap.get(symbol);
    if (hit) return hit;
    const q = extraQuotes.get(symbol);
    return {
      symbol, category: categoryFor(symbol), featured: false,
      price: q?.price ?? null,
      prevClose: q?.previousClose ?? null,
      change: q ? q.price - q.previousClose : null,
      changePercent: q?.changePercent ?? null,
      open: null, dayHigh: null, dayLow: null, volume: null, bid: null, ask: null,
      high52: null, low52: null, avgVolume: null, rangePosition: null,
      return1M: null, return1Y: null,
      source: q?.provenance ?? null, asOf: q?.asOf ?? null,
    };
  }, [rowMap, extraQuotes, categoryFor]);

  /** The rows the active pill is asking for. A section serves its own page
      when it has arrived; until then the headline board's slice stands in. */
  const roomRows = useMemo(() => {
    if (category === "Watchlist") return watchlist.map(rowFor);
    if (category === "Trending") return rows;
    return sections[category] ?? rows.filter((r) => categoryFor(r.symbol) === category);
  }, [category, rows, sections, watchlist, rowFor, categoryFor]);

  /* The search narrows the room by ticker or name — instant, over rows the
     page already holds. Rails and breadth stay on the unfiltered room: typing
     "NV" should not convince the page the whole market is up. */
  const displayRows = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return roomRows;
    return roomRows.filter((r) =>
      displaySymbol(r.symbol).includes(q)
      || r.symbol.toUpperCase().includes(q)
      || (nameOf(r.symbol) ?? "").toUpperCase().includes(q));
  }, [roomRows, query]);

  /* A ticker the room doesn't hold is still one keystroke from its page —
     offered only when the search comes up EMPTY. While matches are on screen
     the rows themselves are the answer, and a guessy "open X directly" next
     to real results would route to pages that may not exist. */
  const jumpSymbol = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q || displayRows.length > 0) return null;
    return /^[A-Z.:]{1,10}(\/[A-Z]{3,4})?$/.test(q) ? q : null;
  }, [query, displayRows]);

  /** The rails follow the pill: the whole market's movers on Trending (the
      server already computed them), the slice's own movers otherwise. */
  const railMovers = useMemo(() => {
    if (category === "Trending") return movers;
    return moversFromRows(roomRows);
  }, [category, movers, roomRows]);

  const breadth = railMovers?.breadth ?? null;

  // The grid keeps its old character: biggest movers first, unquoted last.
  const gridRows = useMemo(() => [...displayRows].sort((a, b) => {
    const ca = a.changePercent, cb = b.changePercent;
    if (ca == null && cb == null) return a.symbol.localeCompare(b.symbol);
    if (ca == null) return 1;
    if (cb == null) return -1;
    return Math.abs(cb) - Math.abs(ca);
  }), [displayRows]);

  // Featured hero: the biggest mover among the board's featured symbols — and
  // if none of those are quoted yet, the biggest mover overall.
  const featured = category !== "Trending" ? undefined
    : gridRows.find((r) => featuredSet.has(r.symbol) && r.price != null)?.symbol
      ?? gridRows.find((r) => r.price != null)?.symbol;

  const gridSymbols = gridRows
    .map((r) => r.symbol)
    .filter((s) => s !== featured);

  const loading = rows.length === 0;
  /** The list is still loading when its own page hasn't landed and the board's
      slice has nothing to stand in with. */
  const listLoading = category === "Watchlist"
    ? false
    : openSection
      ? sections[openSection] == null && roomRows.length === 0
      : loading;
  const stamp = asOf
    ? new Date(asOf).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  const dayPnL = account ? account.equity - account.dayStartEquity : 0;
  const equityStrip = account ? (
    <div className="flex items-baseline gap-2 tnum" aria-label="Account equity and day change">
      <span className="text-sm font-semibold text-ink-1">{usd(account.equity, 0)}</span>
      <span className={`text-xs ${dayPnL > 0 ? "text-gain" : dayPnL < 0 ? "text-loss" : "text-ink-3"}`}>
        {pct(account.dayStartEquity > 0 ? dayPnL / account.dayStartEquity : 0)}
      </span>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="terminal" right={equityStrip} />
      <GettingStarted />

      {welcome && (
        <p className="mx-4 mt-4 rounded-lg border border-gold/25 bg-gold/8 px-4 py-2.5 text-sm text-gold md:mx-6">
          Your simulated $100,000 is live, {userName.split(" ")[0]}. Spend it on lessons, not luck.
        </p>
      )}
      {stale && (
        <p className="mx-4 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning md:mx-6">
          Prices paused — reconnecting to the data feed. The numbers below are the last good read.
        </p>
      )}

      {/* Category strip — a segmented scroller; the thumb slides between rooms.
          Eight rooms now, so the strip travels sideways on a phone: the pills
          stay full height (a 44px target) and the track keeps its own scroll,
          which never becomes the page's. */}
      <div className="sticky top-14 z-40 border-b border-hairline bg-bg0/85 px-4 backdrop-blur-md md:px-6">
        <nav
          className="-mx-4 flex items-center overflow-x-auto overscroll-x-contain px-4 py-2 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
          aria-label="Market categories">
          <div className="flex shrink-0 gap-0.5 rounded-full border border-hairline bg-bg1 p-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`pressable relative min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors md:min-h-9 md:px-4 ${
                  category === c ? "text-gold" : "text-ink-3 hover:text-ink-1"
                }`}
                aria-pressed={category === c}>
                {category === c && (
                  <motion.span layoutId="browse-category-thumb" aria-hidden
                    transition={rm ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.45 }}
                    className="absolute inset-0 rounded-full border border-gold/40 bg-gold/12 shadow-[0_0_18px_-6px_var(--gold)]" />
                )}
                <span className="relative whitespace-nowrap">
                  {c}{c === "Watchlist" && watchlist.length ? ` ${watchlist.length}` : ""}
                </span>
              </button>
            ))}
          </div>
          {marketOpen === false && (
            <span className="ml-auto hidden shrink-0 items-center pl-4 text-[11px] text-ink-4 sm:flex">
              US market closed
            </span>
          )}
        </nav>
      </div>

      {/* overflow-x-clip, not hidden: the hero's aura bleeds past the column and
          must not make the page scroll sideways — and `clip` isn't a scrollport,
          so the sticky category strip above keeps sticking. */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-clip px-4 py-5 pb-24 md:px-6 md:pb-10">
        {/* 1 — the state of the market */}
        <PulseStrip rows={rowMap} breadth={breadth} marketOpen={marketOpen} asOf={asOf} stale={stale} />

        {/* 1b — the whole desk at a glance: every venue, with real counts */}
        {category === "Trending" && (
          <VenueMap board={board} rows={rows} onSelect={(c) => setCategory(c)} />
        )}

        {/* 2 — the featured exhibit */}
        {featured && (
          <FeaturedCard symbol={featured} name={nameOf(featured)} kind={categoryFor(featured)}
            quote={quotes.get(featured)} spark={sparks[featured] ?? []} />
        )}

        {/* 3 — what moved */}
        {(listLoading || displayRows.length >= 5) && (
          <MoversRails movers={railMovers} loading={listLoading && !railMovers} />
        )}

        {/* Watchlist management row */}
        {category === "Watchlist" && (
          <div className="mb-3 flex gap-2">
            <SymbolInput value={adding} onChange={setAdding} onSubmit={addToWatchlist} />
            <button type="button" onClick={() => addToWatchlist(adding)}
              className="pressable rounded-full border border-hairline px-5 text-xs text-ink-2 hover:text-ink-1">
              Add
            </button>
          </div>
        )}

        {/* The room's operating note — what happens when you trade here. */}
        {ROOM_NOTE[category] && (
          <p className="mb-3 text-xs leading-relaxed text-ink-4">{ROOM_NOTE[category]}</p>
        )}

        {/* 4 — the board */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
            <svg viewBox="0 0 24 24" aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${category === "Trending" ? "the board" : category.toLowerCase()}…`}
              aria-label="Search this room by ticker or name"
              className="min-h-10 w-full rounded-full border border-hairline bg-bg1 pl-9 pr-8 text-xs text-ink-1 outline-none transition-colors placeholder:text-ink-4 focus:border-gold/50"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                className="pressable absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-4 hover:text-ink-1">
                ×
              </button>
            )}
          </div>
          <p className="tnum text-[11px] text-ink-4">
            {listLoading
              ? "Loading the board…"
              : `${displayRows.length}${query ? ` of ${roomRows.length}` : ""} market${displayRows.length === 1 ? "" : "s"}`}
            {stamp && <span className={stale ? "text-warning" : ""}> · updated {stamp}</span>}
          </p>
          <div className="ml-auto"><ViewToggle view={view} onChange={writeView} /></div>
        </div>

        {/* A ticker this room doesn't hold is still one tap from its page. */}
        {jumpSymbol && (
          <Link href={`/app/m/${encodeURIComponent(jumpSymbol)}`}
            className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/35 bg-gold/8 px-4 text-xs font-semibold text-gold no-underline transition-colors hover:bg-gold/15">
            Open {jumpSymbol} directly
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        )}

        {view === null ? (
          <div className="skeleton h-80 w-full rounded-[var(--r-l)]" />
        ) : view === "table" ? (
          <BoardTable
            rows={displayRows}
            loading={listLoading}
            names={NAME}
            emptyNote={EMPTY_NOTE[category]}
            onRemove={category === "Watchlist" ? removeFromWatchlist : undefined} />
        ) : gridSymbols.length === 0 && !listLoading ? (
          <p className="rounded-2xl border border-hairline bg-bg1 px-6 py-14 text-center text-sm text-ink-4">
            {EMPTY_NOTE[category]}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {gridSymbols.map((s, i) => (
              <div key={s} className="rise-in relative" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
                <MarketCard symbol={s} name={nameOf(s)} kind={categoryFor(s)}
                  quote={quotes.get(s)} spark={sparks[s]} />
                {category === "Watchlist" && (
                  <button onClick={() => removeFromWatchlist(s)}
                    className="pressable absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-bg3/80 text-ink-4 hover:text-loss"
                    aria-label={`Remove ${displaySymbol(s)} from watchlist`}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <p className="pb-6 text-center text-xs text-ink-4">
        Education, not investment advice. Every fill here is simulated.
      </p>
    </div>
  );
}

/** Table | Grid — a two-stop segmented control; the choice sticks. */
function ViewToggle({ view, onChange }: { view: View | null; onChange: (v: View) => void }) {
  const options: { key: View; label: string; icon: React.ReactNode }[] = [
    {
      key: "table", label: "Table",
      icon: (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17M9 6.5v11" />
        </svg>
      ),
    },
    {
      key: "grid", label: "Grid",
      icon: (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      ),
    },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-bg1 p-1" role="group" aria-label="Board view">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          aria-pressed={view === o.key}
          className={`pressable flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition-colors ${
            view === o.key ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
          }`}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FeaturedCard({ symbol, name, kind, quote, spark }: {
  symbol: string; name?: string; kind?: MarketCategory; quote?: Quote; spark: number[];
}) {
  const chg = quote?.changePercent ?? 0;
  const shown = displaySymbol(symbol);
  const instrument = instrumentOf(symbol, kind, name);
  return (
    <div className="rise-in relative mb-4">
      {/* ambient light in the room — a single gold aura behind the hero */}
      <div aria-hidden className="aura aura-gold" />
      {/* the display ticker, ghosted huge behind the exhibit */}
      <span aria-hidden className="ghost absolute -top-2 right-4 z-0 hidden select-none text-[7rem] leading-none sm:block md:text-[9rem]">
        {shown.replace("/", "")}
      </span>
      <Link href={`/app/m/${encodeURIComponent(symbol)}`}
        className="raised raised-2 edge-gold lift group relative z-10 block overflow-hidden">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_400px] md:items-center md:p-6 lg:p-7">
          <div className="min-w-0">
            <p className="kicker" title={instrument.title}>
              Featured · {instrument.label} · biggest move
            </p>
            <h2 className="display mt-2 break-words text-[2.25rem] text-ink-1 sm:text-5xl md:text-6xl">
              {name ?? shown}
            </h2>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {quote ? (
                <>
                  <span className="lumina tnum text-5xl font-semibold tracking-tight text-ink-1 md:text-7xl">
                    {formatPrice(symbol, quote.price)}
                  </span>
                  <span className={`tnum text-lg font-semibold md:text-2xl ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-3"}`}>
                    {pct(chg)}
                  </span>
                </>
              ) : <span className="skeleton h-12 w-52" />}
            </div>
            <span className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-5 text-xs font-semibold text-gold transition-colors group-hover:bg-gold/20">
              Trade {shown}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <HeroSpark points={spark} up={chg >= 0} />
        </div>
      </Link>
    </div>
  );
}

/** The hero's sparkline as an exhibit — gradient-tinted area under the line,
    endpoint held in a soft halo. Decorative; the price above is the data. */
function HeroSpark({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <div className="h-28 w-full rounded-xl bg-bg2 md:h-32" aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const W = 400, H = 128;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - 8 - ((p - min) / range) * (H - 16),
  ] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = coords[coords.length - 1];
  const tone = up ? "var(--gain)" : "var(--loss)";
  const gid = up ? "hero-spark-gain" : "hero-spark-loss";
  const glow = up ? "hero-glow-gain" : "hero-glow-loss";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full md:h-32" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.30" />
          <stop offset="72%" stopColor={tone} stopOpacity="0.04" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} stroke="none" />
      <polyline points={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${glow})`} />
      {/* the live endpoint, held in a phosphor halo */}
      <circle cx={ex} cy={ey} r="9" fill={tone} opacity="0.12" />
      <circle cx={ex} cy={ey} r="5" fill={tone} opacity="0.22" />
      <circle cx={ex} cy={ey} r="2.6" fill={tone} />
    </svg>
  );
}
