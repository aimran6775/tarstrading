/* Shared trading types + formatters for the browse home, market pages, and tray. */

export type Quote = { symbol: string; price: number; previousClose: number; changePercent: number; asOf: number; provenance?: Provenance };

/* ---- provenance -----------------------------------------------------------
   Every price carries where it came from, and the UI says so — the same
   honesty rule as the PAPER banner, applied to data. The client copy of the
   server's Provenance type (src/server/market.ts is server-only). */
export type Provenance = "live" | "delayed" | "eod" | "derived" | "indicative";

/** Badge text per provenance. Short enough for a chip, honest enough to teach:
    a learner should leave knowing what "delayed" and "derived" mean. */
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  live: "LIVE",
  delayed: "DELAYED 15M",
  eod: "EOD",
  derived: "DERIVED",
  indicative: "INDICATIVE",
};

/*
  After-hours (gap 15). A delayed-SIP print at 2am and one at 2pm wore the
  same DELAYED badge, so an overnight price looked as current as a live
  session quote. The distinction is the SESSION, not the feed, so it's
  computed here from the clock rather than stored on the row.
*/
export function isRegularSession(at = new Date()): boolean {
  const et = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = et.getDay();
  if (d === 0 || d === 6) return false;
  const m = et.getHours() * 60 + et.getMinutes();
  return m >= 9 * 60 + 30 && m < 16 * 60;
}

/** The label a delayed equity quote deserves right now — DELAYED 15M during
    the session, AFTER HOURS outside it. Other provenances are unaffected. */
export function provenanceLabel(source: Provenance, symbol?: string): string {
  if (source === "delayed" && !isRegularSession()
    && !(symbol && (symbol.includes("/") || symbol.startsWith("FX:")))) {
    return "AFTER HOURS";
  }
  return PROVENANCE_LABEL[source];
}

/** One-line explanations for tooltips/legends. */
export const PROVENANCE_HELP: Record<Provenance, string> = {
  live: "Real-time trade ticks.",
  delayed: "Consolidated market data, 15 minutes behind.",
  eod: "Last official close — updates daily.",
  derived: "Computed from a related instrument (e.g. an index from its ETF).",
  indicative: "Modeled between official prints — not a market quote.",
};
export type Account = { cash: number; equity: number; dayStartEquity: number };
export type Position = { id: string; symbol: string; qty: number; avgEntryPrice: number };
export type Order = {
  id: string; symbol: string; side: "buy" | "sell"; type: string; qty: number;
  limitPrice: number | null; stopPrice: number | null; status: string;
  filledPrice: number | null; rejectReason: string | null; createdAt: number;
};
export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
/* A signed zero in a P&L colour is the one thing a trading UI must never print:
   -0.0000321 formatted to 2dp became "-0.00%" under a red ▼. Anything that
   rounds to zero is reported as a flat 0.00%. */
export const pct = (v: number) => {
  const p = v * 100;
  if (Math.abs(p) < 0.005) return "0.00%";
  return `${p > 0 ? "+" : ""}${p.toFixed(2)}%`;
};

/* ---- currency pairs -------------------------------------------------------
   Spot FX carries an explicit `FX:` prefix in the exchange (FX:EURUSD) because
   BTC/USD already means "crypto" everywhere here, and an ambiguous ticker in a
   trading engine is a bug waiting to happen. The prefix is plumbing: a user
   must never see it. These are the client's own copies of the server's rules
   (src/server/fx.ts is server-only) — display and formatting, nothing else. */

export const FX_PREFIX = "FX:";
export const isFxSymbol = (s: string) => s.toUpperCase().startsWith(FX_PREFIX);

/** FX:EURUSD → EUR/USD. Anything else comes back untouched. */
export function fxDisplay(symbol: string): string {
  const p = symbol.toUpperCase().slice(FX_PREFIX.length);
  return p.length === 6 ? `${p.slice(0, 3)}/${p.slice(3)}` : p;
}

/** What a user reads. The route still travels on the real symbol. */
export const displaySymbol = (symbol: string) => {
  if (isFxSymbol(symbol)) return fxDisplay(symbol);
  const u = symbol.toUpperCase();
  if (u.startsWith("IDX:")) return u.slice(4);
  if (u.startsWith("FUT:")) return futDisplay(symbol);
  return symbol;
};

/* Quote currencies that trade in the hundreds rather than around 1 — a yen
   cross prints 157.2354 where a major prints 1.16352. The scale belongs to the
   pair, not to the number in hand, so a price and its change always agree. */
const WIDE_QUOTE = /(JPY|HUF|KRW)$/;

/**
 * Decimals a price deserves. Equities and crypto settle in cents; spot FX moves
 * in pips (0.0001), so two decimals would round a currency pair's whole trading
 * day away.
 */
export function priceDigits(symbol: string): number {
  if (!isFxSymbol(symbol)) return 2;
  return WIDE_QUOTE.test(symbol.toUpperCase()) ? 4 : 5;
}

/** A price in its own units: dollars for securities, bare pips for a pair. */
export function formatPrice(symbol: string, value: number): string {
  const d = priceDigits(symbol);
  if (!isFxSymbol(symbol)) return usd(value, d);
  // A currency pair is a ratio, not an amount of dollars — no currency mark.
  return value.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** A signed move in the instrument's own units. */
export function formatSignedPrice(symbol: string, value: number): string {
  return `${value >= 0 ? "+" : "−"}${formatPrice(symbol, Math.abs(value))}`;
}

/* ---- indices & futures ----------------------------------------------------
   Index levels (IDX:SPX) and futures contracts (FUT:ESU6) are QUOTE-ONLY:
   you don't buy the S&P 500 number, you buy SPY — and the futures desk needs
   a margin model we haven't built yet. Prefixed like FX so nothing ambiguous
   ever reaches the exchange; the order API's symbol regex rejects both. */
export const IDX_PREFIX = "IDX:";
export const FUT_PREFIX = "FUT:";
export const isIndexSymbol = (s: string) => s.toUpperCase().startsWith(IDX_PREFIX);
export const isFutureSymbol = (s: string) => s.toUpperCase().startsWith(FUT_PREFIX);
/** Quote-only instruments: shown, charted, never tradable. Futures graduated
    to full trading when the margin desk landed — only index levels remain. */
export const isQuoteOnly = (s: string) => isIndexSymbol(s);

/* ---- futures contract specs (client copy) ---------------------------------
   Multiplier and margins mirror src/server/futures.ts — the server enforces;
   this copy lets the ticket SHOW what it is about to require. */
export type FuturesUiSpec = { multiplier: number; im: number; mm: number };
export const FUTURES_UI: Record<string, FuturesUiSpec> = {
  ES: { multiplier: 50, im: 23000, mm: 21000 }, NQ: { multiplier: 20, im: 26000, mm: 24000 },
  YM: { multiplier: 5, im: 12000, mm: 11000 }, RTY: { multiplier: 50, im: 9500, mm: 8600 },
  MES: { multiplier: 5, im: 2300, mm: 2100 }, MNQ: { multiplier: 2, im: 2600, mm: 2400 },
  MYM: { multiplier: 0.5, im: 1200, mm: 1100 }, M2K: { multiplier: 5, im: 950, mm: 860 },
  ZT: { multiplier: 2000, im: 2200, mm: 2000 }, ZF: { multiplier: 1000, im: 2700, mm: 2500 },
  ZN: { multiplier: 1000, im: 3600, mm: 3300 }, ZB: { multiplier: 1000, im: 5200, mm: 4700 },
  CL: { multiplier: 1000, im: 12000, mm: 11000 }, NG: { multiplier: 10000, im: 6500, mm: 5900 },
  RB: { multiplier: 42000, im: 9500, mm: 8600 }, HO: { multiplier: 42000, im: 9500, mm: 8600 },
  MCL: { multiplier: 100, im: 1200, mm: 1100 },
  GC: { multiplier: 100, im: 26000, mm: 24000 }, SI: { multiplier: 5000, im: 32000, mm: 29000 },
  HG: { multiplier: 25000, im: 11000, mm: 10000 }, PL: { multiplier: 50, im: 6500, mm: 5900 },
  PA: { multiplier: 100, im: 12000, mm: 11000 }, MGC: { multiplier: 10, im: 2600, mm: 2400 },
  ZC: { multiplier: 50, im: 2300, mm: 2100 }, ZS: { multiplier: 50, im: 4600, mm: 4200 },
  ZW: { multiplier: 50, im: 3300, mm: 3000 }, ZL: { multiplier: 600, im: 3300, mm: 3000 },
  ZM: { multiplier: 100, im: 3100, mm: 2800 },
  LE: { multiplier: 400, im: 7500, mm: 6800 }, HE: { multiplier: 400, im: 5200, mm: 4700 },
  "6E": { multiplier: 125000, im: 3600, mm: 3300 }, "6B": { multiplier: 62500, im: 2900, mm: 2700 },
  "6J": { multiplier: 12500000, im: 4100, mm: 3800 }, "6A": { multiplier: 100000, im: 2700, mm: 2500 },
  "6C": { multiplier: 100000, im: 2100, mm: 1900 },
};

/** FUT:ESU6 → its UI spec, or null for unlisted products. */
export function futuresUiSpec(symbol: string): FuturesUiSpec | null {
  const t = symbol.toUpperCase().slice(FUT_PREFIX.length);
  const m = /^([A-Z0-9]{1,3}?)[FGHJKMNQUVXZ]\d{1,2}$/.exec(t);
  return m ? FUTURES_UI[m[1]] ?? null : null;
}

/** IDX:SPX → SPX; FUT:ESU6 → ES Sep '26 (CME month codes). */
const FUT_MONTHS: Record<string, string> = {
  F: "Jan", G: "Feb", H: "Mar", J: "Apr", K: "May", M: "Jun",
  N: "Jul", Q: "Aug", U: "Sep", V: "Oct", X: "Nov", Z: "Dec",
};
export function futDisplay(symbol: string): string {
  const t = symbol.toUpperCase().slice(FUT_PREFIX.length);
  // Venues mix year formats: ESU6 (one digit) and NGU26 (two). Both are real.
  const m = /^([A-Z0-9]{1,3}?)([FGHJKMNQUVXZ])(\d{1,2})$/.exec(t);
  if (!m) return t;
  // Single-digit years are this decade's: 6 → '26. Good until 2030, reviewed then.
  const year = m[3].length === 2 ? m[3] : `2${m[3]}`;
  return `${m[1]} ${FUT_MONTHS[m[2]]} '${year}`;
}

/** The pills the browse page groups markets under. */
/* The board's sections. Global = foreign companies (ADRs) and country/region
   funds — real US-listed securities that carry world-market exposure without a
   foreign data feed. FX = spot currency pairs (FX: prefixed). Indices and
   Futures are quote-only reference markets. */
export type MarketCategory = "Crypto" | "ETFs" | "Stocks" | "Global" | "FX" | "Income" | "Indices" | "Futures";

/** One row of the curated house board, as served to the client by the server. */
export type BoardEntry = { symbol: string; category: MarketCategory; featured: boolean };

const ETFS = new Set(["SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "GLD"]);

/** Shape-based fallback classification — used for off-board symbols (watchlist
    additions) and when the curated board is unavailable. */
export function categoryOf(symbol: string): MarketCategory {
  if (isFxSymbol(symbol)) return "FX";
  if (isIndexSymbol(symbol)) return "Indices";
  if (isFutureSymbol(symbol)) return "Futures";
  if (symbol.includes("/")) return "Crypto";
  if (ETFS.has(symbol)) return "ETFs";
  return "Stocks";
}

/*
  Where a position's symbol should link. An OCC option contract has no page of
  its own — the underlying's terminal is where its chain and its ticket live —
  so an option routes there with the Options tray open. Everything else links
  to itself. Client-safe (no server-only imports), so every surface that lists
  positions can use it.
*/
const OCC = /^([A-Z]{1,6})\d{6}[CP]\d{8}$/;
export function marketHrefFor(symbol: string): string {
  const m = OCC.exec(symbol.toUpperCase());
  return m
    ? `/app/m/${encodeURIComponent(m[1])}?tray=options`
    : `/app/m/${encodeURIComponent(symbol)}`;
}

/*
  One option contract controls 100 shares. The exchange applies this in cash,
  realized P&L, equity marks and every margin term — but the DISPLAY surfaces
  didn't, so a 5-lot bought at $4.20 showed a value of $21 instead of $2,100
  while account equity showed the truth. The app contradicted itself about
  money, which is the worst thing a trading product can do.
*/
const OCC_RE = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;
export const isOptionTicker = (s: string) => OCC_RE.test(s.toUpperCase());
/** Dollars per 1.0 of quoted price: options ×100, futures their spec
    multiplier, everything else 1:1 — every display P&L math uses this. */
export const contractSize = (s: string) =>
  isOptionTicker(s) ? 100 : isFutureSymbol(s) ? futuresUiSpec(s)?.multiplier ?? 1 : 1;
