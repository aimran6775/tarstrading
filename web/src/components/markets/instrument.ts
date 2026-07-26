import { isFxSymbol, fxDisplay, type MarketCategory } from "@/components/trading/shared";

/*
  What kind of thing is this, really?

  A world board is full of instruments that look like ordinary tickers and
  behave nothing like them: ABEV is a Brazilian brewer's depositary receipt,
  BBJP is a basket of Japan, a bank's preferred is a bond wearing an equity
  costume. The board says WHERE a symbol lives (its section); this says WHAT
  it is, in one short label with a plain-English explanation behind it.

  It only ever reads evidence the client actually holds:
    1. the symbol's shape — an `FX:` prefix or a slash is proof, not a guess;
    2. the security's own registered name, when the page has one;
    3. otherwise the curated section, unrefined.
  Nothing here infers a classification the data doesn't state. When the
  evidence stops, so does the label.
*/

export type Instrument = {
  /** Two or three words, rendered in micro caps. */
  label: string;
  /** The tooltip / screen-reader gloss — what that word means. */
  title: string;
};

const ADR: Instrument = {
  label: "ADR",
  title: "American depositary receipt — a foreign company traded on a US exchange.",
};
const COUNTRY_FUND: Instrument = {
  label: "Country fund",
  title: "A fund holding one country or region's market in a single US-listed share.",
};
const PREFERRED: Instrument = {
  label: "Preferred",
  title: "Preferred stock — fixed dividends ahead of common shareholders, little upside.",
};
const CLOSED_END: Instrument = {
  // Short enough to survive the table's symbol column; the title carries the rest.
  label: "Closed-end",
  title: "A closed-end fund — a fixed share count that can trade above or below its holdings.",
};
const BOND_FUND: Instrument = {
  label: "Bond fund",
  title: "A fund holding bonds — its income comes from interest, not earnings.",
};
const FX_PAIR: Instrument = {
  label: "FX pair",
  title: "A spot currency pair — the price of the first currency in the second.",
};
const CRYPTO_PAIR: Instrument = {
  label: "Crypto pair",
  title: "A crypto pair, quoted against the dollar and traded around the clock.",
};
const ETF: Instrument = {
  label: "ETF",
  title: "An exchange-traded fund — a basket of holdings that trades like one share.",
};
const WORLD: Instrument = {
  label: "World market",
  title: "World-market exposure: a foreign company or a country fund listed in the US.",
};
const INCOME: Instrument = {
  label: "Income",
  title: "An income instrument — held for the payments it makes, not for growth.",
};
const STOCK: Instrument = {
  label: "Stock",
  title: "Common stock — a share of one company.",
};

/* Registered names are the ticker directory's own text ("… American Depositary
   Shares", "… 5.375% Non-Cumulative Perpetual Preferred Stock"), so matching
   them reads the security's own description rather than inventing one. */
const SAYS_ADR = /american depositary|\badrs?\b/i;
const SAYS_PREFERRED = /\bpreferred\b|\bpfd\b/i;
const SAYS_CLOSED_END = /closed[-\s]end/i;
const SAYS_BOND = /\bbond\b|treasury|municipal|\bmuni\b/i;
const SAYS_FUND = /\betf\b|\bfund\b|\btrust\b|\bindex\b|\bportfolio\b/i;

/**
 * The instrument behind a row. `name` is the security's registered name when
 * the surface has one — it sharpens the answer and is never required.
 */
export function instrumentOf(
  symbol: string,
  category: MarketCategory | null | undefined,
  name?: string,
): Instrument {
  // 1 — shape. Unambiguous, and true whatever the board says.
  if (isFxSymbol(symbol)) return FX_PAIR;
  if (symbol.includes("/")) return CRYPTO_PAIR;

  // 2 — the security's own name, most specific first.
  if (name) {
    if (SAYS_PREFERRED.test(name)) return PREFERRED;
    if (SAYS_CLOSED_END.test(name)) return CLOSED_END;
    if (SAYS_ADR.test(name)) return ADR;
    if (category === "Global" && SAYS_FUND.test(name)) return COUNTRY_FUND;
    if (category === "Income" && SAYS_BOND.test(name)) return BOND_FUND;
    if (SAYS_FUND.test(name) && category === "ETFs") return ETF;
  }

  // 3 — the section, unrefined. Honest about how much we know.
  switch (category) {
    case "FX": return FX_PAIR;
    case "Crypto": return CRYPTO_PAIR;
    case "ETFs": return ETF;
    case "Global": return WORLD;
    case "Income": return INCOME;
    case "Stocks": return STOCK;
    default: return STOCK;
  }
}

/* ---- currency names -------------------------------------------------------
   ISO 4217 is fixed vocabulary, not market data — naming EUR/USD "Euro · US
   Dollar" states what the code already means. Unknown codes stay codes. */

const CURRENCY: Record<string, string> = {
  USD: "US Dollar", EUR: "Euro", JPY: "Japanese Yen", GBP: "British Pound",
  CHF: "Swiss Franc", AUD: "Australian Dollar", CAD: "Canadian Dollar",
  NZD: "New Zealand Dollar", MXN: "Mexican Peso", SEK: "Swedish Krona",
  NOK: "Norwegian Krone", DKK: "Danish Krone", SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar", CNH: "Chinese Yuan", CNY: "Chinese Yuan",
  ZAR: "South African Rand", TRY: "Turkish Lira", PLN: "Polish Zloty",
  INR: "Indian Rupee", BRL: "Brazilian Real", KRW: "South Korean Won",
  ILS: "Israeli Shekel", THB: "Thai Baht", CZK: "Czech Koruna", HUF: "Hungarian Forint",
};

/** "FX:EURUSD" → "Euro · US Dollar", when both codes are known. */
export function fxPairName(symbol: string): string | undefined {
  if (!isFxSymbol(symbol)) return undefined;
  const [base, quote] = fxDisplay(symbol).split("/");
  const b = CURRENCY[base], q = CURRENCY[quote];
  return b && q ? `${b} · ${q}` : undefined;
}
