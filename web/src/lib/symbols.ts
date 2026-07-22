/*
  A curated symbol dictionary for instant, offline autocomplete — no API call,
  no rate-limit cost. Free-form tickers still work (the market service will
  resolve or gap them honestly); this just makes the common ones discoverable
  by name as well as ticker.
*/

export type SymbolEntry = { symbol: string; name: string };

export const SYMBOLS: SymbolEntry[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOG", name: "Alphabet (Google)" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "MU", name: "Micron Technology" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "SMCI", name: "Super Micro Computer" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "BRK.B", name: "Berkshire Hathaway" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "COST", name: "Costco" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "F", name: "Ford" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "ABNB", name: "Airbnb" },
  { symbol: "SHOP", name: "Shopify" },
  { symbol: "SQ", name: "Block" },
  { symbol: "PYPL", name: "PayPal" },
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF" },
  { symbol: "IWM", name: "Russell 2000 ETF" },
  { symbol: "DIA", name: "Dow Jones ETF" },
  { symbol: "VTI", name: "Total US Market ETF" },
  { symbol: "GLD", name: "Gold ETF" },
  { symbol: "SLV", name: "Silver ETF" },
  { symbol: "USO", name: "US Oil Fund" },
  { symbol: "TLT", name: "20+ Year Treasury ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
  { symbol: "SMH", name: "Semiconductor ETF" },
  { symbol: "BTC/USD", name: "Bitcoin" },
  { symbol: "ETH/USD", name: "Ethereum" },
  { symbol: "SOL/USD", name: "Solana" },
  { symbol: "XRP/USD", name: "XRP" },
  { symbol: "DOGE/USD", name: "Dogecoin" },
];

/** Rank matches: ticker prefix > ticker contains > name contains. */
export function searchSymbols(query: string, limit = 6): SymbolEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const scored = SYMBOLS.map((e) => {
    const sym = e.symbol.toUpperCase();
    const name = e.name.toUpperCase();
    let score = -1;
    if (sym.startsWith(q)) score = 0;
    else if (sym.includes(q)) score = 1;
    else if (name.includes(q)) score = 2;
    return { e, score };
  }).filter((x) => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.e.symbol.length - b.e.symbol.length);
  return scored.slice(0, limit).map((x) => x.e);
}
