import { NextResponse } from "next/server";
import { sql as dsql } from "drizzle-orm";
import { currentAdmin } from "@/server/auth";
import { db, schema } from "@/server/db";
import { feedsFastTick, feedsSlowTick } from "@/server/feeds";
import { liveFeedStatus } from "@/server/live-feed";

/*
  Feeds control — the console's view of the free-data mesh. GET reports every
  source's health plus the quote cache's provenance mix and freshness; POST
  runs a full pass right now (fast sweep + slow feeds), the same code the
  scheduler drives, so an operator can watch a change take effect immediately.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 403 });

  const [sources, mix] = await Promise.all([
    db.select().from(schema.feedStatus).orderBy(schema.feedStatus.source),
    db.execute<{ source: string; n: number; fresh2m: number; fresh1h: number }>(dsql`
      select source,
             count(*)::int as n,
             count(*) filter (where updated_at > ${Date.now() - 2 * 60_000})::int  as fresh2m,
             count(*) filter (where updated_at > ${Date.now() - 3_600_000})::int as fresh1h
        from quote_cache group by source order by n desc
    `),
  ]);

  return NextResponse.json({
    ok: true,
    sources,
    provenanceMix: Array.from(mix),
    liveFeed: liveFeedStatus(),
    asOf: Date.now(),
  });
}

export async function POST() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const [fast, slow] = await Promise.all([feedsFastTick(), feedsSlowTick()]);
  return NextResponse.json({ ok: true, fast, slow });
}
