import "server-only";
import { db, schema } from "./db";
import { desc, sql as dsql } from "drizzle-orm";

/*
  The watchdog (gap 45).

  A four-and-a-half hour scheduler freeze went completely unnoticed until a
  manual audit found it: every feed sat at the closing print, every user saw
  a frozen board, and nothing anywhere said so. Monitoring that only a human
  audit can trigger is not monitoring.

  This checks the vital signs the platform depends on, records a verdict the
  console renders, and — critically — is CHEAP and read-only, so it can run
  on every heartbeat without becoming a load problem itself.

  It deliberately does NOT try to self-heal. An alarm that silently restarts
  things hides the pathology; the console shows exactly what is late and by
  how long, and the runbook says what to do.
*/

export type Vital = {
  name: string;
  ok: boolean;
  detail: string;
  /** Seconds since this vital last succeeded, when that's meaningful. */
  ageSec?: number;
};

export type WatchdogReport = { ok: boolean; at: number; vitals: Vital[] };

/** How stale each feed may be before it counts as late. The sweep is the
    canary — it runs every 60s, so 6 minutes late means several missed beats,
    not a slow tick. */
const LIMITS: Record<string, number> = {
  sweep: 6 * 60,
  "live-slots": 10 * 60,
  fx: 36 * 3600,
  "indices-daily": 36 * 3600,
  futures: 36 * 3600,
};

export async function runWatchdog(): Promise<WatchdogReport> {
  const now = Date.now();
  const vitals: Vital[] = [];

  // 1. The heartbeat itself — is the scheduler alive?
  try {
    const [last] = await db.select().from(schema.cronRuns)
      .orderBy(desc(schema.cronRuns.createdAt)).limit(1);
    const age = last ? Math.round((now - last.createdAt) / 1000) : Infinity;
    vitals.push({
      name: "heartbeat", ok: age < 15 * 60, ageSec: Number.isFinite(age) ? age : undefined,
      detail: last ? `last run ${Math.round(age / 60)}m ago` : "never run",
    });
  } catch (e) {
    vitals.push({ name: "heartbeat", ok: false, detail: `db unreachable: ${msg(e)}` });
  }

  // 2. Every feed against its own freshness budget.
  try {
    const feeds = await db.select().from(schema.feedStatus);
    for (const f of feeds) {
      const limit = LIMITS[f.source];
      if (!limit) continue;
      const age = f.lastRunAt ? Math.round((now - Number(f.lastRunAt)) / 1000) : Infinity;
      vitals.push({
        name: `feed:${f.source}`,
        ok: age < limit && f.ok === 1,
        ageSec: Number.isFinite(age) ? age : undefined,
        detail: f.lastRunAt
          ? `${Math.round(age / 60)}m ago, budget ${Math.round(limit / 60)}m${f.ok === 1 ? "" : ", reporting errors"}`
          : "never run",
      });
    }
  } catch (e) {
    vitals.push({ name: "feeds", ok: false, detail: `unreadable: ${msg(e)}` });
  }

  // 3. Quote freshness at the population level — the number a user would
  //    actually feel. Board rows on the live/delayed tiers should be minutes
  //    old, never hours.
  try {
    const [row] = Array.from(await db.execute<{ stale: number; total: number }>(dsql`
      select
        count(*) filter (where q.source in ('live','delayed') and ${now} - q.updated_at > 1800000)::int as stale,
        count(*)::int as total
      from quote_cache q
      join platform_symbols p on p.symbol = q.symbol and p.enabled = 1
    `));
    const stale = row?.stale ?? 0, total = row?.total ?? 0;
    vitals.push({
      name: "quote-freshness",
      ok: total === 0 || stale / total < 0.1,
      detail: `${stale}/${total} board rows stale over 30m`,
    });
  } catch (e) {
    vitals.push({ name: "quote-freshness", ok: false, detail: `unreadable: ${msg(e)}` });
  }

  const report: WatchdogReport = { ok: vitals.every((v) => v.ok), at: now, vitals };

  // Record the verdict where the console reads it. feed_status is already the
  // health surface, so the watchdog reports itself as one more source.
  try {
    const row = {
      lastRunAt: now, ok: report.ok ? 1 : 0,
      covered: vitals.filter((v) => v.ok).length,
      detail: JSON.stringify(report.vitals).slice(0, 4000),
    };
    await db.insert(schema.feedStatus).values({ source: "watchdog", ...row })
      .onConflictDoUpdate({ target: schema.feedStatus.source, set: row });
  } catch { /* the check must never be what breaks the beat */ }

  return report;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : "unknown").slice(0, 120);
