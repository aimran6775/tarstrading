import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { PageHeader, StatCard } from "../ui";
import MarketsBoard, { type BoardRow } from "./board";

/*
  Markets control — the curated house board the product shows.

  Reads platform_symbols straight from the vault (the same shape the
  /api/admin/markets GET route serves the apps) and enriches every listing
  with its stored bar count, so an operator can see at a glance which
  symbols are warm and which are cold shells the product would show empty.
*/
export const metadata = { title: "Markets" };
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const board = await db.select().from(schema.platformSymbols)
    .orderBy(schema.platformSymbols.rank, schema.platformSymbols.symbol);

  // Coverage: how many stored bars back each listing (warm vs cold), and what
  // instrument each listing actually IS — the directory's kind, so an operator
  // can see a preferred or an ADR sitting in the wrong section at a glance.
  const symbols = board.map((b) => b.symbol);
  const coverage = new Map<string, number>();
  const kinds = new Map<string, string>();
  const names = new Map<string, string>();
  if (symbols.length) {
    const [counts, directory] = await Promise.all([
      db.select({ symbol: schema.bars.symbol, n: sql<number>`count(*)::int` })
        .from(schema.bars).where(inArray(schema.bars.symbol, symbols))
        .groupBy(schema.bars.symbol),
      db.select({ symbol: schema.tickers.symbol, kind: schema.tickers.kind, name: schema.tickers.name })
        .from(schema.tickers).where(inArray(schema.tickers.symbol, symbols)),
    ]);
    for (const c of counts) coverage.set(c.symbol, c.n);
    for (const d of directory) { kinds.set(d.symbol, d.kind); names.set(d.symbol, d.name); }
  }

  const rows: BoardRow[] = board.map((b) => ({
    ...b,
    bars: coverage.get(b.symbol) ?? 0,
    kind: kinds.get(b.symbol) ?? null,
    name: names.get(b.symbol) ?? null,
  }));
  const enabled = rows.filter((r) => r.enabled === 1);
  const featured = rows.filter((r) => r.featured === 1);
  const cold = rows.filter((r) => r.bars === 0);

  return (
    <>
      <PageHeader title="Markets" right={
        <span className="font-mono text-[11px] text-ink-4">platform_symbols · the universe the product shows</span>
      } />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Listed" value={rows.length} sub="curated symbols" />
        <StatCard label="Enabled" value={enabled.length}
          sub={`${rows.length - enabled.length} held back`} />
        <StatCard label="Featured" value={featured.length} tone={featured.length ? "warn" : "default"}
          sub="hero slots" />
        <StatCard label="Cold" value={cold.length} tone={cold.length ? "loss" : "gain"}
          sub={cold.length ? "no bars stored" : "every listing has data"} />
      </div>

      <MarketsBoard rows={rows} />
    </>
  );
}
