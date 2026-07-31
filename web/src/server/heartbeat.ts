import "server-only";
import { randomUUID } from "crypto";
import { tickAllRunningAgents } from "./agents";
import { purgeExpiredSessions } from "./auth";
import { backfillTick } from "./backfill";
import { settleAllExpiredOptions, settleAllFuturesVM, enforceAllMaintenance, reconcileRestingOrders } from "./exchange";
import { purgeOldNotifications } from "./notify";
import { runWatchdog } from "./watchdog";
import { feedsSlowTick } from "./feeds";
import { tickAllPrivateMarkets } from "./private-markets";
import { maybeSyncTickers } from "./tickers";
import { db, schema } from "./db";
import { lt } from "drizzle-orm";

/*
  The platform heartbeat — agents tick, the bar store heals, sessions sweep,
  telemetry is pruned, and the ticker directory keeps itself fresh. Runs from
  TWO triggers that share this one implementation:
  - the in-process scheduler on the backend service (instrumentation.ts), so
    everything runs on Railway with no external cron at all;
  - /api/cron/tick (CRON_SECRET-guarded) for any external scheduler that
    wants to drive it instead.
  Every run lands in cron_runs for the admin logbook.
*/
export async function runHeartbeat(kind = "tick") {
  const t0 = Date.now();
  let agents = { users: 0, actions: 0 };
  let backfill: Awaited<ReturnType<typeof backfillTick>> | null = null;
  // allSettled: one failing task (a flaky backfill fetch, a purge hiccup) must
  // not discard the agent metrics that already succeeded, nor falsely mark the
  // whole run failed.
  // The slow feeds (FX daily, index closes/calibration, futures) run FIRST,
  // alone: they share the Massive token bucket with backfillTick, and when the
  // two ran concurrently backfill — an unbounded consumer healing ~1,700
  // series — drained every token every beat, so futures discovery sat at 1/14
  // and the NDX close never landed. The slow feeds are bounded (a handful of
  // calls, most beats zero), so they take their tokens off the top and
  // backfill spends what's genuinely left over.
  const [fRes] = await Promise.allSettled([feedsSlowTick()]);
  /*
    Exchange-mutating sweeps run SEQUENTIALLY, never in parallel. Each of
    them (agents, resting-order reconcile, option expiry, futures VM) opens
    SELECT … FOR UPDATE transactions on the same account rows out of ONE
    shared 10-connection pool — run together, blocked waiters held pool
    connections that the lock holders needed to finish, and the whole
    backend wedged: no heartbeats landed for hours and every DB-bound route
    hung. Parallelism here bought milliseconds and cost the scheduler.
  */
  const seq = async <T,>(f: () => Promise<T>): Promise<PromiseSettledResult<T>> => {
    try { return { status: "fulfilled", value: await f() }; }
    catch (e) { return { status: "rejected", reason: e }; }
  };
  const aRes = await seq(tickAllRunningAgents);
  const rRes = await seq(reconcileRestingOrders);
  const oRes = await seq(settleAllExpiredOptions);
  const futRes = await seq(settleAllFuturesVM);
  // Reg-T maintenance runs for EVERY book, not just futures holders (gap 1):
  // an equity account below 25% was previously computed, displayed, ignored.
  const mRes = await seq(enforceAllMaintenance);
  // These never touch account locks — they can share the beat freely.
  const [bRes, pRes, peRes] = await Promise.allSettled([
    backfillTick(),
    purgeExpiredSessions(),
    tickAllPrivateMarkets(),
  ]);
  // Vital signs last, so the report reflects the beat that just ran (gap 45).
  const wd = await runWatchdog().catch(() => null);
  void purgeOldNotifications();
  void fRes; void futRes; void mRes; // reported via feed_status/journal; never fail the run
  if (aRes.status === "fulfilled") agents = aRes.value;
  if (bRes.status === "fulfilled") backfill = bRes.value;
  // Expiring options settle on the heartbeat, so a contract closes itself
  // whether or not its owner is watching.
  if (oRes.status === "fulfilled" && oRes.value > 0) {
    agents = { ...agents, actions: agents.actions + oRes.value };
  }
  // Private-markets quarters advance on their own slower clock (see
  // tickAllPrivateMarkets); capital calls and distributions count as actions.
  if (peRes.status === "fulfilled") {
    agents = { ...agents, actions: agents.actions + peRes.value.calls + peRes.value.distributions };
  }
  // Resting orders are re-checked centrally so they fill when the MARKET moves,
  // not when their owner happens to open a page.
  if (rRes.status === "fulfilled" && rRes.value > 0) {
    agents = { ...agents, actions: agents.actions + rRes.value };
  }
  const ok = aRes.status === "fulfilled" && bRes.status === "fulfilled" && pRes.status === "fulfilled" ? 1 : 0;

  // Retention: api_calls is pure telemetry that otherwise grows forever and
  // slows the admin feed. Keep a week. (Fire-and-forget; never fails a run.)
  db.delete(schema.apiCalls).where(lt(schema.apiCalls.createdAt, Date.now() - 7 * 86_400_000)).catch(() => {});
  // quote_history backs intraday chart density; a week is more than any
  // intraday view reads and keeps the table from growing without bound.
  db.delete(schema.quoteHistory).where(lt(schema.quoteHistory.t, Date.now() - 7 * 86_400_000)).catch(() => {});

  // Keep the tradable-universe directory fresh (no-op when recent; runs in
  // the background paced by the market token bucket).
  void maybeSyncTickers();

  const ms = Date.now() - t0;
  await db.insert(schema.cronRuns).values({
    id: randomUUID(), kind, users: agents.users, actions: agents.actions,
    ms, ok, detail: backfill ? JSON.stringify(backfill) : null, createdAt: Date.now(),
  }).catch(() => {});

  return { ok: ok === 1, ...agents, backfill, ms, at: Date.now(), watchdog: wd };
}
