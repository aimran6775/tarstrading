import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql as dsql } from "drizzle-orm";
import { currentAdmin } from "@/server/auth";
import { db, schema } from "@/server/db";

/*
  Rank the board by real liquidity.

  Bulk-add can only order by what the ticker directory knows (name, kind,
  exchange) — so a sweep lands alphabetically, which is why the board led with
  A, B, F, G. Once history is filled we know something far better: how much
  each symbol actually trades. This re-ranks every listing by its 90-day
  average dollar volume (price × shares), within its category, so the board
  leads with the names people genuinely trade.

  Dollar volume, not share count: a $3 stock trading 10M shares is not more
  liquid than a $400 one trading 500k, and share count alone would say it is.
*/
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const since = Math.floor(Date.now() / 1000) - 90 * 86_400;

  // One statement: score every symbol by average dollar volume over the window,
  // then rank within category (crypto after ETFs after stocks stays the board's
  // shape — rank is only ever compared inside a category by the product).
  const ranked = await db.execute<{ symbol: string; rank: number; dollar_volume: number }>(dsql`
    with liquidity as (
      select b.symbol,
             avg(b.c * b.v) as dollar_volume
        from bars b
       where b.timeframe = '1Y' and b.t >= ${since} and b.v > 0
       group by b.symbol
    ),
    scored as (
      select p.symbol,
             p.category,
             coalesce(l.dollar_volume, 0) as dollar_volume,
             row_number() over (
               partition by p.category
               order by coalesce(l.dollar_volume, 0) desc, p.symbol
             ) * 10 as new_rank
        from platform_symbols p
        left join liquidity l on l.symbol = p.symbol
    )
    update platform_symbols p
       set rank = s.new_rank
      from scored s
     where p.symbol = s.symbol
    returning p.symbol, p.rank, s.dollar_volume
  `);

  const rows = Array.from(ranked);
  const top = rows.sort((a, b) => a.rank - b.rank).slice(0, 10)
    .map((r) => r.symbol);

  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId: admin.id, action: "market.rerank",
    detail: JSON.stringify({ reranked: rows.length, top }), createdAt: Date.now(),
  }).catch(() => {});

  return NextResponse.json({ ok: true, reranked: rows.length, top });
}
