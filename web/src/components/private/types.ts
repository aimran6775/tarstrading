/*
  The allocator's vocabulary — the exact shapes `/api/private` serves, plus the
  formatters and the plain-English glosses for the jargon. Private markets are
  an acronym thicket (TVPI, DPI, RVPI, unfunded), and this product teaches, so
  every ratio carries its definition wherever it's shown.
*/

export type Strategy =
  | "buyout" | "venture" | "growth" | "credit" | "real_estate" | "secondaries";

export type Fund = {
  id: string;
  name: string;
  strategy: string;
  vintage: number;
  termYears: number;
  mgmtFee: number;
  carry: number;
  hurdle: number;
  targetMultiple: number;
  volatility: number;
  minCommitment: number;
  blurb: string | null;
};

export type Metrics = {
  committed: number; called: number; distributed: number; nav: number;
  unfunded: number; tvpi: number; dpi: number; rvpi: number;
  irr: number | null; moic: number;
};

export type Flow = {
  id: string;
  commitmentId: string;
  kind: "call" | "distribution";
  amount: number;
  quarter: number;
  note: string | null;
  createdAt: number;
};

export type Commitment = {
  id: string;
  fundId: string;
  committed: number;
  called: number;
  distributed: number;
  nav: number;
  quarters: number;
  status: "investing" | "harvesting" | "closed";
  outcomeMultiple: number;
  /** Years elapsed on the simulated clock (= quarters / 4). */
  age: number;
  fund: Fund | null;
  metrics: Metrics;
};

export type PrivateData = {
  ok: true;
  cash: number;
  equity: number;
  funds: Fund[];
  commitments: Commitment[];
  totals: Metrics;
  flows: Flow[];
};

// ------------------------------------------------------------- formatting

/** Whole dollars with separators — allocator precision, no cents. */
export const money = (v: number) =>
  (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US");

/** Compact dollars for axis labels and tight chips: $2.4M, $850k. */
export function compact(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(a >= 100_000 ? 0 : 0)}k`;
  return `${sign}$${Math.round(a)}`;
}

/** Multiples read as 1.42×. Zero paid-in means the ratio isn't defined yet. */
export const multiple = (v: number, called: number) =>
  called > 0 ? `${v.toFixed(2)}×` : "—";

/** IRR is null until the flows can support one — that's "not yet meaningful",
    and it must NEVER be rendered as 0%. */
export const irrText = (v: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`;

/** Years, spoken the way an allocator speaks them. */
export function ageText(years: number): string {
  if (years < 0.25) return "Just closed";
  if (years < 1) return `${Math.round(years * 4)} quarter${Math.round(years * 4) === 1 ? "" : "s"} in`;
  return `${years.toFixed(1)} years in`;
}

// ------------------------------------------------------------- vocabulary

export const STRATEGY_LABEL: Record<string, string> = {
  buyout: "Buyout",
  venture: "Venture",
  growth: "Growth equity",
  credit: "Private credit",
  real_estate: "Real assets",
  secondaries: "Secondaries",
};

/** One honest sentence per strategy — what the manager actually does. */
export const STRATEGY_NOTE: Record<string, string> = {
  buyout: "Buys control of established, cash-generating companies, often with debt, and sells them on.",
  venture: "Backs young companies where most fail and a rare one pays for the whole fund.",
  growth: "Takes minority stakes in companies that already work and need capital to go faster.",
  credit: "Lends rather than owns. Returns arrive as interest, so the money starts coming back early.",
  real_estate: "Owns property for income and eventual sale. Slower to call, steadier to distribute.",
  secondaries: "Buys other investors' existing fund stakes, usually at a discount and already deployed.",
};

export const STATUS_LABEL: Record<Commitment["status"], string> = {
  investing: "Investing",
  harvesting: "Harvesting",
  closed: "Wound up",
};

export const STATUS_NOTE: Record<Commitment["status"], string> = {
  investing: "The manager is still calling capital and buying.",
  harvesting: "Buying is done. Exits are landing and cash is coming back.",
  closed: "The fund's life is over. Everything left has been realized and paid out.",
};

/** The jargon, defined once. Shown beneath every metric that uses it. */
export const GLOSS = {
  committed: "What you promised. It is not cash — it is an obligation.",
  called: "What the manager has actually drawn from your account so far.",
  distributed: "Cash returned to you as investments were sold or repaid.",
  nav: "The current mark on what the fund still holds for you.",
  unfunded: "Committed minus called — money you still owe, on the manager's schedule, not yours.",
  tvpi: "Total value ÷ paid-in. Distributions plus NAV, against every dollar called.",
  dpi: "Distributions ÷ paid-in. Cash actually back in hand. 1.00× means you've been made whole.",
  rvpi: "Residual value ÷ paid-in. The part of your return that is still only a mark.",
  irr: "The annualized rate the dated cash flows imply. Blank until the flows can support one.",
} as const;
