import { db } from "@/server/db";
import { sql as dsql } from "drizzle-orm";
import { brainStatus } from "@/server/llm";
import { liveFeedStatus } from "@/server/live-feed";

/*
  Overview — every number that answers "is the platform healthy?" on one
  screen: people, activity, and the data plane. ONE SQL round trip — eleven
  scalar subqueries in a single statement, so this page costs exactly one
  pooled connection no matter how busy the app is.
*/
export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

type Snapshot = {
  users: number; orders24: number; fills24: number; agents_running: number;
  bars_rows: number; series_rows: number; calls1h: number; errors1h: number;
  quote_rows: number; sessions: number; chats24: number;
};

export default async function AdminOverview() {
  const dayAgo = Date.now() - 86_400_000;
  const hourAgo = Date.now() - 3_600_000;
  const brain = brainStatus();
  const feed = liveFeedStatus();

  const [snap] = await db.execute<Snapshot>(dsql`
    select
      (select count(*)::int from users)                                                    as users,
      (select count(*)::int from orders where created_at >= ${dayAgo})                     as orders24,
      (select count(*)::int from orders where created_at >= ${dayAgo}
        and status = 'filled')                                                             as fills24,
      (select count(*)::int from agents where status = 'running')                          as agents_running,
      (select count(*)::int from bars)                                                     as bars_rows,
      (select count(*)::int from sync_state)                                               as series_rows,
      (select count(*)::int from api_calls where created_at >= ${hourAgo})                 as calls1h,
      (select count(*)::int from api_calls where created_at >= ${hourAgo}
        and status >= 400)                                                                 as errors1h,
      (select count(*)::int from quote_cache)                                              as quote_rows,
      (select count(*)::int from sessions where expires_at >= ${Date.now()})               as sessions,
      (select count(*)::int from agent_chats where created_at >= ${dayAgo})                as chats24
  `);
  const { users, orders24, fills24, agents_running: agentsRunning, bars_rows: barsRows,
    series_rows: seriesRows, calls1h, errors1h, quote_rows: quoteRows, sessions, chats24 } = snap;

  const KPIS: [string, string | number, string][] = [
    ["Traders", users, "accounts on the platform"],
    ["Orders · 24h", orders24, `${fills24} filled`],
    ["Agents live", agentsRunning, "running right now"],
    ["Bars stored", barsRows.toLocaleString(), `${seriesRows} series in the vault`],
    ["Upstream · 1h", calls1h, `${errors1h} errors`],
    ["Quotes cached", quoteRows, "symbols warm"],
    ["Sessions", sessions, "currently valid"],
    ["Assistant · 24h", chats24, "messages"],
    ["AI brain", brain.provider, brain.provider === "ollama" ? `local · ${brain.model}` : brain.provider === "hf" ? "hosted fallback" : "no model"],
    ["Live feed", feed.enabled ? (feed.stocks.authed || feed.crypto.authed ? "on" : "connecting") : "off", `${feed.symbolsTicking} symbols ticking`],
  ];

  return (
    <>
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Overview</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {KPIS.map(([label, value, sub]) => (
          <div key={label} className="panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
            <p className="tnum mt-1 text-2xl font-semibold text-ink-1">{value}</p>
            <p className="mt-0.5 text-[11px] text-ink-4">{sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-4">
        All reads are live from Postgres. Data ops has per-symbol coverage; System has the cron logbook.
      </p>
    </>
  );
}
