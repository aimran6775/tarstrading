import "server-only";
import { randomUUID } from "crypto";
import { tickAllRunningAgents } from "./agents";
import { purgeExpiredSessions } from "./auth";
import { backfillTick } from "./backfill";
import { settleAllExpiredOptions, reconcileRestingOrders } from "./exchange";
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
  const [aRes, bRes, pRes, oRes, peRes, rRes] = await Promise.allSettled([
    tickAllRunningAgents(),
    backfillTick(),
    purgeExpiredSessions(),
    settleAllExpiredOptions(),
    tickAllPrivateMarkets(),
    reconcileRestingOrders(),
  ]);
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

  // Keep the tradable-universe directory fresh (no-op when recent; runs in
  // the background paced by the market token bucket).
  void maybeSyncTickers();

  const ms = Date.now() - t0;
  await db.insert(schema.cronRuns).values({
    id: randomUUID(), kind, users: agents.users, actions: agents.actions,
    ms, ok, detail: backfill ? JSON.stringify(backfill) : null, createdAt: Date.now(),
  }).catch(() => {});

  return { ok: ok === 1, ...agents, backfill, ms, at: Date.now() };
}
