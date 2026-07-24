import "server-only";
import { db } from "./db";
import { sql as dsql } from "drizzle-orm";
import { STARTING_CASH } from "./auth";

/*
  The command-center data layer. One heavy scalar query for the headline numbers
  plus a few small shaped queries (sparkline, pulse, movers) — all fired in
  parallel by the page. Everything is live from Postgres; nothing is cached, so
  the Overview always tells the truth about right now.
*/

export type Health = { status: "nominal" | "degraded" | "critical"; signals: Signal[] };
export type Signal = { label: string; level: "ok" | "warn" | "crit"; detail: string };

type Snapshot = {
  users: number; new_users24: number; orders24: number; fills24: number; rejects24: number;
  agents_running: number; bars_rows: number; series_rows: number; calls1h: number; errors1h: number;
  quote_rows: number; sessions: number; chats24: number;
  aum: number; day_pnl: number; profitable: number; underwater: number; last_cron: number | null;
};

export type Mover = { id: string; name: string; email: string; equity: number; ret: number };
export type PulseRow = { name: string; symbol: string; side: string; type: string; status: string; createdAt: number };

export async function getOverview(now: number) {
  const dayAgo = now - 86_400_000;
  const hourAgo = now - 3_600_000;

  const [snapRows, sparkRows, pulse, topRows, bottomRows] = await Promise.all([
    db.execute<Snapshot>(dsql`
      select
        (select count(*)::int from users)                                                as users,
        (select count(*)::int from users where created_at >= ${dayAgo})                  as new_users24,
        (select count(*)::int from orders where created_at >= ${dayAgo})                 as orders24,
        (select count(*)::int from orders where created_at >= ${dayAgo} and status='filled')   as fills24,
        (select count(*)::int from orders where created_at >= ${dayAgo} and status='rejected') as rejects24,
        (select count(*)::int from agents where status='running')                        as agents_running,
        (select count(*)::int from bars)                                                 as bars_rows,
        (select count(*)::int from sync_state)                                           as series_rows,
        (select count(*)::int from api_calls where created_at >= ${hourAgo})             as calls1h,
        (select count(*)::int from api_calls where created_at >= ${hourAgo} and status >= 400) as errors1h,
        (select count(*)::int from quote_cache)                                          as quote_rows,
        (select count(*)::int from sessions where expires_at >= ${now})                  as sessions,
        (select count(*)::int from agent_chats where created_at >= ${dayAgo})            as chats24,
        (select coalesce(sum(equity),0)::float8 from accounts)                           as aum,
        (select coalesce(sum(equity - day_start_equity),0)::float8 from accounts)        as day_pnl,
        (select count(*)::int from accounts where equity > ${STARTING_CASH})             as profitable,
        (select count(*)::int from accounts where equity < ${STARTING_CASH})             as underwater,
        (select max(created_at)::float8 from cron_runs)                                  as last_cron
    `),
    // 24 hourly buckets of order volume, oldest → newest.
    db.execute<{ h: number; n: number }>(dsql`
      select floor((created_at - ${dayAgo}) / 3600000)::int as h, count(*)::int as n
      from orders where created_at >= ${dayAgo} group by 1 order by 1
    `),
    db.execute<PulseRow>(dsql`
      select u.name as name, o.symbol as symbol, o.side as side, o.type as type,
             o.status as status, o.created_at::float8 as "createdAt"
      from orders o join users u on u.id = o.user_id
      order by o.created_at desc limit 8
    `),
    db.execute<{ id: string; name: string; email: string; equity: number }>(dsql`
      select u.id, u.name, u.email, a.equity from accounts a join users u on u.id = a.user_id
      order by a.equity desc limit 3
    `),
    db.execute<{ id: string; name: string; email: string; equity: number }>(dsql`
      select u.id, u.name, u.email, a.equity from accounts a join users u on u.id = a.user_id
      order by a.equity asc limit 3
    `),
  ]);

  const s = snapRows[0];
  const spark = Array.from({ length: 24 }, () => 0);
  for (const r of sparkRows as unknown as { h: number; n: number }[]) {
    if (r.h >= 0 && r.h < 24) spark[r.h] = r.n;
  }
  type MoverRow = { id: string; name: string; email: string; equity: number };
  const toMover = (r: MoverRow): Mover => ({
    id: r.id, name: r.name, email: r.email, equity: r.equity, ret: (r.equity - STARTING_CASH) / STARTING_CASH,
  });

  return {
    snap: s,
    spark,
    pulse: pulse as unknown as PulseRow[],
    top: (topRows as unknown as MoverRow[]).map(toMover),
    bottom: (bottomRows as unknown as MoverRow[]).map(toMover),
  };
}

/** Roll the raw signals into one platform verdict. Worst signal wins. */
export function computeHealth(input: {
  lastCron: number | null; now: number; errors1h: number; calls1h: number;
  feedOk: boolean | "connecting" | "off"; brainOk: boolean;
  halted: boolean; paused: boolean;
}): Health {
  const signals: Signal[] = [];
  const age = input.lastCron ? input.now - input.lastCron : null;

  // Heartbeat — the cron that ticks analysts and sweeps sessions.
  if (age == null) signals.push({ label: "Heartbeat", level: "crit", detail: "never run" });
  else if (age > 30 * 60_000) signals.push({ label: "Heartbeat", level: "crit", detail: `${Math.round(age / 60_000)}m stale` });
  else if (age > 8 * 60_000) signals.push({ label: "Heartbeat", level: "warn", detail: `${Math.round(age / 60_000)}m ago` });
  else signals.push({ label: "Heartbeat", level: "ok", detail: `${Math.max(1, Math.round(age / 60_000))}m ago` });

  // Upstream error rate over the last hour.
  if (input.errors1h > 20) signals.push({ label: "Upstream", level: "crit", detail: `${input.errors1h} errors / 1h` });
  else if (input.errors1h > 0) signals.push({ label: "Upstream", level: "warn", detail: `${input.errors1h} errors / 1h` });
  else signals.push({ label: "Upstream", level: "ok", detail: `${input.calls1h} calls clean` });

  // Live market-data feed.
  if (input.feedOk === true) signals.push({ label: "Live feed", level: "ok", detail: "streaming" });
  else if (input.feedOk === "connecting") signals.push({ label: "Live feed", level: "warn", detail: "connecting" });
  else signals.push({ label: "Live feed", level: "warn", detail: "off" });

  // AI brain availability.
  signals.push(input.brainOk
    ? { label: "AI brain", level: "ok", detail: "reachable" }
    : { label: "AI brain", level: "warn", detail: "no model" });

  // Manual holds are intentional, but must be loud.
  if (input.halted) signals.push({ label: "Order flow", level: "warn", detail: "HALTED (manual)" });
  if (input.paused) signals.push({ label: "Analysts", level: "warn", detail: "PAUSED (manual)" });

  const status = signals.some((x) => x.level === "crit") ? "critical"
    : signals.some((x) => x.level === "warn") ? "degraded" : "nominal";
  return { status, signals };
}
