import "server-only";
import { futuresSpec, productOf } from "./futures";

/*
  SPAN-lite: portfolio margin for the futures book, modeled on how CME
  clearing actually margins a portfolio rather than a pile of lone contracts.

  A real margin desk recognises three kinds of offset:

  1. CALENDAR SPREADS — long CLU6 / short CLV6 is a bet on the SHAPE of the
     curve, not the price of oil. Charging two full IMs would be double-
     counting risk that mostly cancels.
  2. MICRO ↔ FULL — 10 Micro E-mini S&P against 1 short E-mini is the same
     index twice; near-total offset.
  3. INTER-COMMODITY SPREADS — long S&P / short Nasdaq, long gold / short
     silver: correlated products in opposite directions earn a published
     spread credit (CME's inter-commodity credits run 30–80%).

  The trick that keeps this small: margins are already RISK-scaled. A micro's
  IM is exactly one-tenth of its full-size contract's, so netting in IM
  DOLLARS — sum of signed im×qty per family — handles micro/full equivalence
  and calendar months with no ratio tables at all. Offset exposure keeps a
  RESIDUAL charge (basis risk never margins to zero), and the whole portfolio
  never drops below a FLOOR of the naive sum, because correlation is a fair-
  weather friend and 1987 exists.

  Educational approximation of the real thing: true SPAN runs 16 risk
  scenarios per combined commodity. The shape — spreads margin cheaper than
  outrights, correlation earns credit, credit is capped — is the lesson.
*/

/** Micros margin as their full-size family so the two offset. */
const FAMILY_ALIAS: Record<string, string> = {
  MES: "ES", MNQ: "NQ", MYM: "YM", M2K: "RTY", MGC: "GC", MCL: "CL",
};

/** Correlated groups for inter-commodity credits. */
const GROUP: Record<string, string> = {
  ES: "equity", NQ: "equity", YM: "equity", RTY: "equity",
  ZT: "rates", ZF: "rates", ZN: "rates", ZB: "rates",
  CL: "energy", NG: "energy", RB: "energy", HO: "energy",
  GC: "metals", SI: "metals", HG: "metals", PL: "metals", PA: "metals",
  ZC: "grains", ZS: "grains", ZW: "grains", ZL: "grains", ZM: "grains",
  LE: "livestock", HE: "livestock",
  "6A": "fx", "6B": "fx", "6C": "fx", "6E": "fx", "6J": "fx",
};

/* Spread credit per group — the fraction of the SMALLER opposing leg that
   comes off. Approximates CME's published inter-commodity credit rates:
   equity indices are near-cointegrated (high), livestock barely (low). */
const GROUP_CREDIT: Record<string, number> = {
  equity: 0.70, rates: 0.60, metals: 0.55, energy: 0.50,
  grains: 0.40, livestock: 0.30, fx: 0.50,
};

/** Offset legs keep 5% — spreads are cheap, never free. */
const RESIDUAL = 0.05;
/** Portfolio IM never drops below 25% of the naive sum. */
const FLOOR = 0.25;

export type SpanBreakdown = {
  /** Portfolio initial margin after all credits (and the floor). */
  im: number;
  /** Portfolio maintenance margin, scaled from IM by the book's own MM/IM ratio. */
  mm: number;
  /** What the same book would require margined contract-by-contract. */
  naiveIm: number;
  naiveMm: number;
  /** Credit earned inside families (calendar spreads, micro-vs-full). */
  intraCredit: number;
  /** Credit earned across correlated products, per group. */
  interCredits: { group: string; credit: number }[];
};

const familyOf = (root: string) => FAMILY_ALIAS[root] ?? root;

/**
 * Portfolio margin for a futures book. Positions are signed contract counts;
 * non-futures symbols are ignored (they margin rate-based elsewhere).
 */
export function portfolioMargin(book: { symbol: string; qty: number }[]): SpanBreakdown {
  type Fam = { grossIm: number; netIm: number; grossMm: number };
  const fams = new Map<string, Fam>();
  let naiveIm = 0, naiveMm = 0;

  for (const p of book) {
    const spec = futuresSpec(p.symbol);
    const root = productOf(p.symbol);
    if (!spec || !root || Math.abs(p.qty) < 1e-9) continue;
    const fam = familyOf(root);
    const f = fams.get(fam) ?? { grossIm: 0, netIm: 0, grossMm: 0 };
    f.grossIm += spec.im * Math.abs(p.qty);
    f.netIm += spec.im * p.qty; // signed: opposing months/sizes cancel here
    f.grossMm += spec.mm * Math.abs(p.qty);
    fams.set(fam, f);
    naiveIm += spec.im * Math.abs(p.qty);
    naiveMm += spec.mm * Math.abs(p.qty);
  }
  if (!fams.size) {
    return { im: 0, mm: 0, naiveIm: 0, naiveMm: 0, intraCredit: 0, interCredits: [] };
  }

  // Step 1 — inside each family: the netted part carries full margin, the
  // offset part (spreads) carries only the residual.
  let afterIntra = 0, intraCredit = 0;
  const directional = new Map<string, number>(); // family → signed net IM
  for (const [fam, f] of fams) {
    const net = Math.abs(f.netIm);
    const offset = f.grossIm - net;
    afterIntra += net + RESIDUAL * offset;
    intraCredit += (1 - RESIDUAL) * offset;
    directional.set(fam, f.netIm);
  }

  // Step 2 — across families in a group: opposing net directions earn the
  // group's spread credit on the smaller side.
  const byGroup = new Map<string, { long: number; short: number }>();
  for (const [fam, netIm] of directional) {
    const g = GROUP[fam];
    if (!g || Math.abs(netIm) < 1e-9) continue;
    const gg = byGroup.get(g) ?? { long: 0, short: 0 };
    if (netIm > 0) gg.long += netIm; else gg.short += -netIm;
    byGroup.set(g, gg);
  }
  const interCredits: { group: string; credit: number }[] = [];
  let interTotal = 0;
  for (const [group, { long, short }] of byGroup) {
    const spreadable = Math.min(long, short);
    if (spreadable < 1e-9) continue;
    const credit = GROUP_CREDIT[group] * spreadable;
    interCredits.push({ group, credit });
    interTotal += credit;
  }

  // The floor: no book margins below a quarter of its naive requirement.
  const im = Math.max(afterIntra - interTotal, FLOOR * naiveIm);
  const mmRatio = naiveIm > 0 ? naiveMm / naiveIm : 1;
  return {
    im,
    mm: im * mmRatio,
    naiveIm,
    naiveMm,
    intraCredit,
    interCredits: interCredits.sort((a, b) => b.credit - a.credit),
  };
}
