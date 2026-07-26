import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, desc } from "drizzle-orm";

/*
  Private markets — the allocator's side of finance.

  This is NOT the exchange with a slower clock. You don't buy a share at a
  price; you COMMIT capital that a manager calls down over years and returns
  as investments exit. Early fees and marks push you underwater before value
  compounds — the J-curve — and that shape is the entire lesson, so it's
  simulated properly rather than dressed up as a slow stock.

  What's modeled:
  - Commitment vs CALLED capital (only called money has left your account)
  - Capital calls front-loaded across the investment period
  - Management fees dragging NAV early (the dip in the J)
  - Distributions as exits land in the harvest years
  - Carry taken by the manager above a preferred return (hurdle)
  - TVPI / DPI / RVPI, and IRR solved from the actual dated cash flows

  The outcome multiple is drawn ONCE, at commitment. The fund's fate is set the
  day you invest — you just don't learn it for years. That's the honest lesson,
  and it's why the draw isn't re-rolled on every tick.
*/

// ---------------------------------------------------------------- the metrics

export type PeMetrics = {
  committed: number; called: number; distributed: number; nav: number;
  unfunded: number; tvpi: number; dpi: number; rvpi: number;
  irr: number | null; moic: number;
};

/**
 * IRR from dated cash flows, by bisection on NPV.
 *
 * Bisection again rather than Newton: private-markets flows are lumpy and
 * sign-flipping, where Newton happily runs off to nonsense. Returns null when
 * no rate in a sane band explains the flows (e.g. only calls so far), because
 * "not yet meaningful" is the truth early in a fund's life.
 */
export function irrOf(flows: { amount: number; atMs: number }[]): number | null {
  if (flows.length < 2) return null;
  const t0 = Math.min(...flows.map((f) => f.atMs));
  const years = (ms: number) => (ms - t0) / (365 * 86_400_000);
  const npv = (rate: number) =>
    flows.reduce((s, f) => s + f.amount / Math.pow(1 + rate, years(f.atMs)), 0);

  let lo = -0.95, hi = 5;
  const nLo = npv(lo), nHi = npv(hi);
  if (!Number.isFinite(nLo) || !Number.isFinite(nHi) || nLo * nHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-7) return mid;
    if (v > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The standard LP ratios, plus IRR when the flows can support one. */
export function peMetrics(
  c: { committed: number; called: number; distributed: number; nav: number },
  flows: { kind: "call" | "distribution"; amount: number; createdAt: number }[] = [],
  navAtMs = Date.now(),
): PeMetrics {
  const unfunded = Math.max(0, c.committed - c.called);
  const tvpi = c.called > 0 ? (c.distributed + c.nav) / c.called : 0;
  const dpi = c.called > 0 ? c.distributed / c.called : 0;
  const rvpi = c.called > 0 ? c.nav / c.called : 0;

  // A call is money out (negative), a distribution money in, and the current
  // NAV counts as a terminal inflow — the standard way to get a live IRR.
  const dated = flows.map((f) => ({
    amount: f.kind === "call" ? -f.amount : f.amount,
    atMs: f.createdAt,
  }));
  if (c.nav > 0) dated.push({ amount: c.nav, atMs: navAtMs });

  return {
    committed: c.committed, called: c.called, distributed: c.distributed, nav: c.nav,
    unfunded, tvpi, dpi, rvpi,
    irr: irrOf(dated),
    moic: tvpi,
  };
}

// ------------------------------------------------------------ the simulation

/** Fraction of the commitment called in a given quarter of the fund's life. */
export function callSchedule(quarter: number, investmentQuarters = 20): number {
  if (quarter < 0 || quarter >= investmentQuarters) return 0;
  // Front-loaded: managers deploy fastest in years 1–3, then taper.
  const progress = quarter / investmentQuarters;
  const weight = Math.exp(-2.2 * progress);
  // Normalizing constant for the same curve across the whole period.
  let total = 0;
  for (let q = 0; q < investmentQuarters; q++) total += Math.exp(-2.2 * (q / investmentQuarters));
  return weight / total;
}

/**
 * Advance one commitment by a quarter: call capital, drag fees, grow the mark,
 * and distribute in the harvest years. Pure given its inputs — the caller
 * persists the result — so the J-curve is testable without a database.
 */
export function advanceQuarter(input: {
  committed: number; called: number; distributed: number; nav: number;
  quarter: number; termYears: number; mgmtFee: number; carry: number;
  hurdle: number; outcomeMultiple: number;
}): { call: number; distribution: number; nav: number; status: "investing" | "harvesting" | "closed" } {
  const { committed, called, distributed, quarter, termYears, mgmtFee, carry, hurdle, outcomeMultiple } = input;
  const totalQuarters = termYears * 4;
  const investmentQuarters = Math.min(20, Math.floor(totalQuarters / 2));

  // 1) Capital call for this quarter (never more than what's unfunded).
  const wanted = committed * callSchedule(quarter, investmentQuarters);
  const call = Math.max(0, Math.min(wanted, committed - called));
  const calledAfter = called + call;

  // 2) Management fee: on committed capital during the investment period, on
  //    invested capital after. This is what puts the J in the J-curve.
  const feeBase = quarter < investmentQuarters ? committed : Math.max(0, calledAfter - distributed);
  const fee = (feeBase * mgmtFee) / 4;

  /*
    3) Move the mark, incrementally: NAV takes in called capital, pays out
    fees, and accrues this quarter's share of the fund's total value creation.

    Two bugs the tests caught, both worth keeping in mind:
    - Growing "total value" and re-deriving NAV from it double-counted
      distributions, letting a deliberately BAD fund (0.6×) pay out 4.9×.
    - Easing NAV straight toward the target made the mark race ahead of
      deployed capital, so the J-curve never dipped — the fund was above water
      from quarter one, which is exactly the misconception this teaches against.

    So value accrual is BACK-LOADED (exponent > 1): investments are carried near
    cost while capital goes to work and fees bite, and value compounds later.
    Total appreciation across the life sums to committed × (multiple − 1).
  */
  const accrued = (q: number) => Math.pow(Math.min(1, (q + 1) / totalQuarters), 1.6);
  const totalAppreciation = committed * (outcomeMultiple - 1);
  const appreciation = totalAppreciation * (accrued(quarter) - accrued(quarter - 1));

  let nav = Math.max(0, input.nav + call - fee + appreciation);

  // 4) Distributions: exits land in the back half of the fund's life.
  let distribution = 0;
  const harvesting = quarter >= investmentQuarters;
  const closed = quarter + 1 >= totalQuarters;

  if (harvesting || closed) {
    const harvestQuarters = Math.max(1, totalQuarters - investmentQuarters);
    const left = Math.max(1, harvestQuarters - (quarter - investmentQuarters));
    // At wind-up everything remaining is realized.
    const grossExit = closed ? nav : nav / left;

    // Carry: the manager takes `carry` of profit ABOVE the preferred return.
    // Below the hurdle — which is where a bad fund lives — carry is zero.
    const preferred = calledAfter * Math.pow(1 + hurdle, (quarter + 1) / 4);
    const profitAbovePref = Math.max(0, distributed + grossExit - preferred);
    const carryTaken = profitAbovePref * carry;

    distribution = Math.max(0, grossExit - carryTaken);
    nav = Math.max(0, nav - grossExit); // the whole exit leaves the fund
  }

  return {
    call,
    distribution,
    nav: closed ? 0 : nav,
    status: closed ? "closed" : harvesting ? "harvesting" : "investing",
  };
}

// ------------------------------------------------------------------ the desk

/** Draw a fund's outcome multiple at commitment — lognormal around target. */
function drawOutcome(targetMultiple: number, volatility: number): number {
  // Box-Muller for a normal, then lognormal so the multiple can't go negative.
  const u1 = Math.random() || 1e-9, u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const mu = Math.log(Math.max(0.2, targetMultiple)) - 0.5 * volatility * volatility;
  return Math.max(0.05, Math.exp(mu + volatility * z));
}

export type CommitResult =
  | { ok: true; commitmentId: string }
  | { ok: false; error: string };

/**
 * Commit capital to a fund. Nothing leaves your account here — that's the
 * point of a commitment, and the most commonly misunderstood thing about
 * private markets. Cash moves only when calls arrive.
 */
export async function commitToFund(userId: string, fundId: string, amount: number): Promise<CommitResult> {
  const [fund] = await db.select().from(schema.peFunds)
    .where(and(eq(schema.peFunds.id, fundId), eq(schema.peFunds.enabled, 1)));
  if (!fund) return { ok: false, error: "That fund isn't open for commitments." };
  if (!Number.isFinite(amount) || amount < fund.minCommitment) {
    return { ok: false, error: `The minimum commitment is $${fund.minCommitment.toLocaleString()}.` };
  }

  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  if (!account) return { ok: false, error: "No account." };

  // You may only promise what your existing unfunded promises still allow —
  // over-committing is a real failure mode, so the sim refuses to hide it.
  const existing = await db.select().from(schema.peCommitments)
    .where(eq(schema.peCommitments.userId, userId));
  const outstanding = existing.reduce((s, c) => s + Math.max(0, c.committed - c.called), 0);
  if (outstanding + amount > account.equity) {
    return {
      ok: false,
      error: `That would leave you unable to fund your calls — $${Math.round(outstanding).toLocaleString()} is already promised against $${Math.round(account.equity).toLocaleString()} of equity.`,
    };
  }

  const id = randomUUID();
  await db.insert(schema.peCommitments).values({
    id, userId, fundId, committed: amount,
    called: 0, distributed: 0, nav: 0, quarters: 0,
    outcomeMultiple: drawOutcome(fund.targetMultiple, fund.volatility),
    status: "investing", createdAt: Date.now(),
  });
  return { ok: true, commitmentId: id };
}

/**
 * Advance every live commitment by one quarter, moving real cash for calls and
 * distributions. Called from the heartbeat on a simulated clock so a ten-year
 * fund plays out in a usable timeframe rather than a decade.
 */
export async function tickPrivateMarkets(userId: string): Promise<{ calls: number; distributions: number }> {
  const commitments = await db.select().from(schema.peCommitments)
    .where(eq(schema.peCommitments.userId, userId));
  let calls = 0, distributions = 0;

  for (const c of commitments) {
    if (c.status === "closed") continue;
    const [fund] = await db.select().from(schema.peFunds).where(eq(schema.peFunds.id, c.fundId));
    if (!fund) continue;

    const step = advanceQuarter({
      committed: c.committed, called: c.called, distributed: c.distributed, nav: c.nav,
      quarter: c.quarters, termYears: fund.termYears, mgmtFee: fund.mgmtFee,
      carry: fund.carry, hurdle: fund.hurdle, outcomeMultiple: c.outcomeMultiple,
    });

    await db.transaction(async (tx) => {
      const [acct] = await tx.select().from(schema.accounts)
        .where(eq(schema.accounts.userId, userId)).for("update");
      if (!acct) return;

      // A call can only take what's actually there. An LP who can't fund a
      // call is in default — modeled as a partial call rather than negative
      // cash, and the shortfall simply isn't called.
      const call = Math.max(0, Math.min(step.call, acct.cash));
      const net = step.distribution - call;
      await tx.update(schema.accounts)
        .set({ cash: acct.cash + net })
        .where(eq(schema.accounts.userId, userId));

      const now = Date.now();
      if (call > 0) {
        await tx.insert(schema.peCashflows).values({
          id: randomUUID(), userId, commitmentId: c.id, kind: "call",
          amount: call, quarter: c.quarters,
          note: `${fund.name} — capital call`, createdAt: now,
        });
        calls++;
      }
      if (step.distribution > 0) {
        await tx.insert(schema.peCashflows).values({
          id: randomUUID(), userId, commitmentId: c.id, kind: "distribution",
          amount: step.distribution, quarter: c.quarters,
          note: `${fund.name} — distribution`, createdAt: now,
        });
        distributions++;
      }

      await tx.update(schema.peCommitments).set({
        called: c.called + call,
        distributed: c.distributed + step.distribution,
        nav: step.nav,
        quarters: c.quarters + 1,
        status: step.status,
      }).where(eq(schema.peCommitments.id, c.id));
    });
  }
  return { calls, distributions };
}

/** The allocator's portfolio: commitments, metrics, and recent cash flows. */
export async function privatePortfolio(userId: string) {
  const commitments = await db.select().from(schema.peCommitments)
    .where(eq(schema.peCommitments.userId, userId));
  const funds = await db.select().from(schema.peFunds);
  const byFund = new Map(funds.map((f) => [f.id, f]));
  const flows = await db.select().from(schema.peCashflows)
    .where(eq(schema.peCashflows.userId, userId))
    .orderBy(desc(schema.peCashflows.createdAt)).limit(100);

  const rows = commitments.map((c) => {
    const mine = flows.filter((f) => f.commitmentId === c.id);
    return {
      ...c,
      fund: byFund.get(c.fundId) ?? null,
      metrics: peMetrics(c, mine),
      /** Years elapsed on the simulated clock. */
      age: c.quarters / 4,
    };
  });

  const totals = peMetrics({
    committed: rows.reduce((s, r) => s + r.committed, 0),
    called: rows.reduce((s, r) => s + r.called, 0),
    distributed: rows.reduce((s, r) => s + r.distributed, 0),
    nav: rows.reduce((s, r) => s + r.nav, 0),
  }, flows.map((f) => ({ kind: f.kind, amount: f.amount, createdAt: f.createdAt })));

  return { commitments: rows, totals, flows };
}

/*
  Advance every allocator's book by a quarter. Called from the heartbeat, but
  only every Nth run — a ten-year fund on a 5-minute clock would finish in
  three hours, which is too fast to feel like anything. One quarter per hour
  plays a full fund life over ~10 days: long enough that a capital call is a
  real event, short enough to see the J-curve resolve.
*/
const QUARTER_EVERY_MS = 60 * 60_000;

export async function tickAllPrivateMarkets(): Promise<{ books: number; calls: number; distributions: number }> {
  const [cfg] = await db.select().from(schema.platformConfig)
    .where(eq(schema.platformConfig.key, "pe.lastTick"));
  const last = cfg ? Number(cfg.value) : 0;
  const now = Date.now();
  if (Number.isFinite(last) && now - last < QUARTER_EVERY_MS) {
    return { books: 0, calls: 0, distributions: 0 };
  }

  const holders = await db.selectDistinct({ userId: schema.peCommitments.userId })
    .from(schema.peCommitments);
  let calls = 0, distributions = 0;
  for (const h of holders) {
    try {
      const r = await tickPrivateMarkets(h.userId);
      calls += r.calls; distributions += r.distributions;
    } catch { /* one book's failure must not stop the sweep */ }
  }

  await db.insert(schema.platformConfig)
    .values({ key: "pe.lastTick", value: String(now), updatedBy: "heartbeat", updatedAt: now })
    .onConflictDoUpdate({
      target: schema.platformConfig.key,
      set: { value: String(now), updatedAt: now },
    });

  return { books: holders.length, calls, distributions };
}
