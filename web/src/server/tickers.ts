import "server-only";
import { db, schema } from "./db";
import { sql as dsql } from "drizzle-orm";
import { tryTakeToken, hasLiveData } from "./market";
import { SYMBOLS } from "@/lib/symbols";

/*
  The tradable-universe directory. One sync walks Massive's reference API
  (/v3/reference/tickers, 1000 rows/page, ~11k active US stocks+ETFs) and
  upserts into the tickers table; the curated crypto pairs ride along so ONE
  search source covers everything the exchange can trade. Paced by the same
  token bucket as quotes (a page only fetches when a token is free), so a sync
  never starves the product of market data — it just takes a few minutes.

  Search is served from Postgres: exact/prefix ticker matches first, then
  name matches, active rows only.
*/

const BASE = "https://api.massive.com";
const KEY = process.env.MASSIVE_API_KEY ?? "";

type RefTicker = { ticker: string; name: string; type?: string; primary_exchange?: string; active?: boolean };
type RefPage = { results?: RefTicker[]; next_url?: string };

// One sync at a time per process; concurrent triggers just observe.
let running: Promise<{ upserted: number; pages: number }> | null = null;

export function tickerSyncRunning(): boolean { return running != null; }

export async function countTickers(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(dsql`select count(*)::int as n from tickers`);
  return row?.n ?? 0;
}

async function lastSyncAt(): Promise<number> {
  const [row] = await db.execute<{ v: string }>(
    dsql`select value as v from platform_config where key = 'tickers_last_sync'`);
  return row ? Number(row.v) || 0 : 0;
}

async function markSynced(): Promise<void> {
  await db.execute(dsql`
    insert into platform_config (key, value, updated_by, updated_at)
    values ('tickers_last_sync', ${String(Date.now())}, null, ${Date.now()})
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`);
}

async function upsertBatch(input: { symbol: string; name: string; kind: string; exchange: string | null }[]) {
  // Reference pages can repeat a symbol (dual listings) — a multi-row upsert
  // may not touch the same row twice, so dedupe by symbol, last one wins.
  const rows = [...new Map(input.map((r) => [r.symbol, r])).values()];
  if (!rows.length) return;
  const now = Date.now();
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(schema.tickers)
      .values(rows.slice(i, i + 500).map((r) => ({ ...r, active: 1, updatedAt: now })))
      .onConflictDoUpdate({
        target: schema.tickers.symbol,
        set: {
          name: dsql`excluded.name`, kind: dsql`excluded.kind`,
          exchange: dsql`excluded.exchange`, active: dsql`excluded.active`,
          updatedAt: dsql`excluded.updated_at`,
        },
      });
  }
}

async function waitForToken(): Promise<void> {
  while (!tryTakeToken()) await new Promise((r) => setTimeout(r, 16_000));
}

async function doSync(): Promise<{ upserted: number; pages: number }> {
  // Crypto pairs from the curated list — they're Alpaca-tradable, not in
  // Massive's stocks reference.
  await upsertBatch(SYMBOLS.filter((s) => s.symbol.includes("/"))
    .map((s) => ({ symbol: s.symbol, name: s.name, kind: "CRYPTO", exchange: null })));

  let url: string | null =
    `${BASE}/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${KEY}`;
  let upserted = 0, pages = 0;

  while (url && pages < 25) { // hard page cap — a runaway cursor never loops forever
    await waitForToken();
    const res: Response = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`tickers-http-${res.status}`);
    const page = (await res.json()) as RefPage;
    const rows = (page.results ?? [])
      .filter((t) => t.ticker && t.name && t.active !== false)
      .map((t) => ({
        symbol: t.ticker.toUpperCase(),
        name: t.name.slice(0, 120),
        kind: t.type ?? "CS",
        exchange: t.primary_exchange ?? null,
      }));
    await upsertBatch(rows);
    upserted += rows.length;
    pages += 1;
    url = page.next_url ? `${page.next_url}&apiKey=${KEY}` : null;
  }

  await markSynced();
  return { upserted, pages };
}

/** Kick a directory sync (idempotent — a running sync is shared). */
export function syncTickers(): Promise<{ upserted: number; pages: number }> {
  if (!hasLiveData) return Promise.resolve({ upserted: 0, pages: 0 });
  if (!running) {
    running = doSync().finally(() => { running = null; });
  }
  return running;
}

/** Auto-heal: sync when the directory is empty or older than a week.
    Fire-and-forget from the backend heartbeat. */
export async function maybeSyncTickers(): Promise<void> {
  if (!hasLiveData || running) return;
  const [n, last] = await Promise.all([countTickers(), lastSyncAt()]);
  if (n < 1000 || Date.now() - last > 7 * 86_400_000) {
    syncTickers().catch(() => { /* next heartbeat retries */ });
  }
}

export type TickerHit = { symbol: string; name: string };

/** Ranked search: exact ticker → ticker prefix → name substring. */
export async function searchTickers(q: string, limit = 8): Promise<TickerHit[]> {
  const term = q.trim().toUpperCase();
  if (!term) return [];
  const like = term.replace(/[%_]/g, "");
  const rows = await db.execute<TickerHit & { rank: number }>(dsql`
    select symbol, name,
      case when symbol = ${term} then 0
           when symbol like ${like + "%"} then 1
           else 2 end as rank
    from tickers
    where active = 1 and (symbol like ${like + "%"} or name ilike ${"%" + like + "%"})
    order by rank, length(symbol), symbol
    limit ${limit}`);
  return (rows as unknown as TickerHit[]).map((r) => ({ symbol: r.symbol, name: r.name }));
}
