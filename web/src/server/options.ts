import "server-only";

/*
  The options desk.

  Chains are REAL: Alpaca serves the listed contracts and their live quotes, so
  strikes, expiries and prices are the actual market — nothing synthetic. What
  Alpaca doesn't hand us on this tier is the greeks, so we compute them here
  with Black-Scholes, and we solve implied volatility from the mid price rather
  than assuming a number. Every greek is therefore consistent with the quote a
  user can actually see.

  Scope, deliberately: LONG options only (buy to open, sell to close, and
  expiry settlement). Short/naked options carry unlimited-loss risk whose
  margin model is a genuinely different animal; teaching that badly would be
  worse than not teaching it yet.
*/

const TRADE = "https://paper-api.alpaca.markets";
const DATA = "https://data.alpaca.markets";
const KEY = process.env.ALPACA_KEY_ID ?? "";
const SECRET = process.env.ALPACA_SECRET_KEY ?? "";
export const optionsReady = KEY.length > 0 && SECRET.length > 0;

const headers = () => ({
  "APCA-API-KEY-ID": KEY,
  "APCA-API-SECRET-KEY": SECRET,
  accept: "application/json",
});

/** The contract multiplier: one option covers 100 shares. */
export const CONTRACT_SIZE = 100;

// ---------------------------------------------------------------- OCC symbols

export type OptionLeg = {
  symbol: string;          // OCC, e.g. AAPL260727C00205000
  underlying: string;      // AAPL
  expiry: string;          // 2026-07-27
  type: "call" | "put";
  strike: number;
};

/**
 * Parse an OCC option symbol: ROOT + YYMMDD + C|P + strike×1000 (8 digits).
 * Returns null for anything that isn't one — this is also how the exchange
 * tells an option apart from a stock, so it must never guess.
 */
export function parseOptionSymbol(symbol: string): OptionLeg | null {
  const m = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(symbol.toUpperCase());
  if (!m) return null;
  const [, root, yy, mm, dd, cp, strike8] = m;
  const year = 2000 + Number(yy);
  const month = Number(mm), day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    symbol: symbol.toUpperCase(),
    underlying: root,
    expiry: `${year}-${mm}-${dd}`,
    type: cp === "C" ? "call" : "put",
    strike: Number(strike8) / 1000,
  };
}

export const isOptionSymbol = (s: string) => parseOptionSymbol(s) !== null;

/** Years until expiry (options expire at the close, ~4pm ET). */
export function yearsToExpiry(expiry: string, now = Date.now()): number {
  const end = new Date(`${expiry}T20:00:00Z`).getTime(); // 4pm ET ≈ 20:00 UTC
  return Math.max(0, (end - now) / (365 * 86_400_000));
}

// ------------------------------------------------------------- Black-Scholes

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 — ~7 decimal places). */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Standard normal PDF. */
const normPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export type Greeks = {
  price: number; delta: number; gamma: number; theta: number; vega: number; rho: number;
};

/**
 * Black-Scholes price and greeks for a European option. American options on
 * non-dividend names differ negligibly for teaching purposes; the difference
 * is smaller than the bid-ask spread users actually pay.
 *
 * theta is PER DAY and vega/rho PER PERCENTAGE POINT — the units traders read,
 * not the raw per-year/per-unit partials.
 */
export function blackScholes(
  type: "call" | "put", spot: number, strike: number, years: number,
  vol: number, rate = 0.04,
): Greeks {
  // At (or past) expiry the option is worth exactly its intrinsic value.
  if (years <= 0 || vol <= 0 || spot <= 0 || strike <= 0) {
    const intrinsic = type === "call"
      ? Math.max(0, spot - strike)
      : Math.max(0, strike - spot);
    const itm = intrinsic > 0;
    return {
      price: intrinsic,
      delta: itm ? (type === "call" ? 1 : -1) : 0,
      gamma: 0, theta: 0, vega: 0, rho: 0,
    };
  }

  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * years) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const disc = Math.exp(-rate * years);
  const nd1 = normCdf(d1), nd2 = normCdf(d2);
  const pdf = normPdf(d1);

  const price = type === "call"
    ? spot * nd1 - strike * disc * nd2
    : strike * disc * normCdf(-d2) - spot * normCdf(-d1);

  const delta = type === "call" ? nd1 : nd1 - 1;
  const gamma = pdf / (spot * vol * sqrtT);
  // Per-year theta, then divided into a per-day number.
  const thetaYear = type === "call"
    ? -(spot * pdf * vol) / (2 * sqrtT) - rate * strike * disc * nd2
    : -(spot * pdf * vol) / (2 * sqrtT) + rate * strike * disc * normCdf(-d2);
  const vegaYear = spot * pdf * sqrtT;
  const rhoYear = type === "call"
    ? strike * years * disc * nd2
    : -strike * years * disc * normCdf(-d2);

  return {
    price,
    delta,
    gamma,
    theta: thetaYear / 365,
    vega: vegaYear / 100,
    rho: rhoYear / 100,
  };
}

/**
 * Implied volatility from a market price, by bisection.
 *
 * Bisection rather than Newton-Raphson on purpose: vega collapses toward zero
 * for deep in/out-of-the-money contracts, where Newton diverges wildly. This
 * is slower and utterly reliable — the right trade for a number users see.
 * Returns null when the price is outside what any volatility can produce.
 */
export function impliedVol(
  type: "call" | "put", marketPrice: number, spot: number, strike: number,
  years: number, rate = 0.04,
): number | null {
  if (!(marketPrice > 0) || years <= 0 || spot <= 0 || strike <= 0) return null;

  // No volatility can price below intrinsic, nor above the underlying itself.
  const intrinsic = type === "call"
    ? Math.max(0, spot - strike * Math.exp(-rate * years))
    : Math.max(0, strike * Math.exp(-rate * years) - spot);
  if (marketPrice < intrinsic - 0.005) return null;

  let lo = 0.005, hi = 5;
  if (blackScholes(type, spot, strike, years, hi, rate).price < marketPrice) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = blackScholes(type, spot, strike, years, mid, rate).price;
    if (Math.abs(p - marketPrice) < 1e-6) return mid;
    if (p > marketPrice) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------- chain fetching

export type ChainQuote = {
  bid: number | null; ask: number | null; mid: number | null; last: number | null;
  volume: number | null; openInterest: number | null;
};
export type ChainRow = OptionLeg & ChainQuote & {
  iv: number | null;
  greeks: Greeks | null;
  intrinsic: number;
  extrinsic: number | null;
  inTheMoney: boolean;
};

type AlpacaContract = {
  symbol: string; underlying_symbol: string; expiration_date: string;
  type: "call" | "put"; strike_price: string; open_interest: string | null;
  close_price: string | null; tradable: boolean;
};

/** Expiries listed for an underlying (nearest first). */
export async function listExpiries(underlying: string, max = 8): Promise<string[]> {
  if (!optionsReady) return [];
  const qs = new URLSearchParams({
    underlying_symbols: underlying.toUpperCase(),
    status: "active", limit: "10000",
  });
  const res = await fetch(`${TRADE}/v2/options/contracts?${qs}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`contracts ${res.status}`);
  const json = await res.json() as { option_contracts?: AlpacaContract[] };
  const set = new Set((json.option_contracts ?? []).map((c) => c.expiration_date));
  return [...set].sort().slice(0, max);
}

/**
 * The chain for one underlying and expiry: real contracts, real quotes, with
 * implied vol and greeks computed per row from the mid price.
 */
export async function optionChain(
  underlying: string, expiry: string, spot: number, strikeWindow = 14,
): Promise<ChainRow[]> {
  if (!optionsReady) return [];
  const root = underlying.toUpperCase();

  const qs = new URLSearchParams({
    underlying_symbols: root, expiration_date: expiry,
    status: "active", limit: "10000",
  });
  const res = await fetch(`${TRADE}/v2/options/contracts?${qs}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`contracts ${res.status}`);
  const contracts = ((await res.json()) as { option_contracts?: AlpacaContract[] }).option_contracts ?? [];
  if (!contracts.length) return [];

  // Keep the strikes around the money — a full chain is hundreds of rows and
  // the wings are noise for anyone learning.
  const withStrike = contracts
    .map((c) => ({ c, strike: Number(c.strike_price) }))
    .filter((x) => Number.isFinite(x.strike))
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
  const keepStrikes = new Set(withStrike.slice(0, strikeWindow * 2).map((x) => x.strike));
  const kept = withStrike.filter((x) => keepStrikes.has(x.strike)).map((x) => x.c);

  // Quotes, batched.
  const quotes = new Map<string, { bid: number | null; ask: number | null; last: number | null; volume: number | null }>();
  for (let i = 0; i < kept.length; i += 100) {
    const chunk = kept.slice(i, i + 100);
    try {
      const sq = new URLSearchParams({ symbols: chunk.map((c) => c.symbol).join(",") });
      const r = await fetch(`${DATA}/v1beta1/options/snapshots?${sq}`, { headers: headers(), cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json() as {
        snapshots?: Record<string, {
          latestQuote?: { bp: number; ap: number };
          latestTrade?: { p: number };
          dailyBar?: { v: number };
        }>;
      };
      for (const [sym, s] of Object.entries(j.snapshots ?? {})) {
        const bid = s.latestQuote?.bp, ask = s.latestQuote?.ap;
        quotes.set(sym, {
          bid: typeof bid === "number" && bid > 0 ? bid : null,
          ask: typeof ask === "number" && ask > 0 ? ask : null,
          last: typeof s.latestTrade?.p === "number" ? s.latestTrade.p : null,
          volume: typeof s.dailyBar?.v === "number" ? s.dailyBar.v : null,
        });
      }
    } catch { /* a missing quote leaves nulls, never a fake price */ }
  }

  const years = yearsToExpiry(expiry);
  const rows = kept.map((c) => {
    const leg: OptionLeg = {
      symbol: c.symbol, underlying: root, expiry: c.expiration_date,
      type: c.type, strike: Number(c.strike_price),
    };
    const q = quotes.get(c.symbol);
    const bid = q?.bid ?? null, ask = q?.ask ?? null;
    const mid = bid != null && ask != null ? (bid + ask) / 2
      : q?.last ?? (c.close_price != null ? Number(c.close_price) : null);

    const iv = mid != null ? impliedVol(leg.type, mid, spot, leg.strike, years) : null;
    const greeks = iv != null ? blackScholes(leg.type, spot, leg.strike, years, iv) : null;
    const intrinsic = leg.type === "call"
      ? Math.max(0, spot - leg.strike)
      : Math.max(0, leg.strike - spot);

    return {
      ...leg, bid, ask, mid, last: q?.last ?? null,
      volume: q?.volume ?? null,
      openInterest: c.open_interest != null ? Number(c.open_interest) : null,
      iv, greeks, intrinsic,
      extrinsic: mid != null ? Math.max(0, mid - intrinsic) : null,
      inTheMoney: intrinsic > 0,
    };
  }).sort((a, b) => a.strike - b.strike || a.type.localeCompare(b.type));

  /*
    Deep in-the-money contracts often quote a mid BELOW intrinsic — market
    makers won't pay parity on something they'd have to carry — so no
    volatility can reproduce the price and the solve returns null. Leaving the
    whole row blank would be worse than useless: a 0.95-delta call showing "—"
    reads as broken. So we fill the gaps at the chain's prevailing (median)
    volatility. `iv` stays null — we don't claim to have solved one — while
    the greeks become the honest estimate they are.
  */
  const solved = rows.map((r) => r.iv).filter((v): v is number => v != null).sort((a, b) => a - b);
  if (solved.length) {
    const median = solved[Math.floor(solved.length / 2)];
    for (const r of rows) {
      if (!r.greeks) r.greeks = blackScholes(r.type, spot, r.strike, years, median);
    }
  }
  return rows;
}

// ------------------------------------------------------------ option quotes

/**
 * Live prices for arbitrary option symbols — what the exchange marks positions
 * against. Mid when there's a two-sided market, else the last trade. Missing
 * symbols are simply absent from the map; callers fall back to entry price
 * rather than inventing one.
 */
export async function optionQuotes(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const list = symbols.filter(isOptionSymbol);
  if (!optionsReady || !list.length) return out;

  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try {
      const qs = new URLSearchParams({ symbols: chunk.join(",") });
      const res = await fetch(`${DATA}/v1beta1/options/snapshots?${qs}`, { headers: headers(), cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json() as {
        snapshots?: Record<string, {
          latestQuote?: { bp: number; ap: number };
          latestTrade?: { p: number };
        }>;
      };
      for (const [sym, s] of Object.entries(json.snapshots ?? {})) {
        const bid = s.latestQuote?.bp, ask = s.latestQuote?.ap;
        const mid = typeof bid === "number" && bid > 0 && typeof ask === "number" && ask > 0
          ? (bid + ask) / 2
          : typeof s.latestTrade?.p === "number" && s.latestTrade.p > 0 ? s.latestTrade.p : null;
        if (mid != null) out.set(sym, mid);
      }
    } catch { /* absent means "unknown", never a fabricated mark */ }
  }
  return out;
}
