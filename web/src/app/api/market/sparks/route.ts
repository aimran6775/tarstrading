import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, asc, eq, inArray } from "drizzle-orm";

/*
  Sparklines for market cards — served STRICTLY from the bar vault, never
  upstream. A symbol with no stored history yet returns an empty series; the
  background backfill heals it and the next visit has a line. Downsampled to
  ≤32 points so a whole browse page costs one cheap query.
*/
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 32);
  if (!symbols.length) return NextResponse.json({ ok: false, error: "No symbols." }, { status: 400 });

  const rows = await db.select({
    symbol: schema.bars.symbol, t: schema.bars.t, c: schema.bars.c,
  }).from(schema.bars)
    .where(and(eq(schema.bars.timeframe, "3M"), inArray(schema.bars.symbol, symbols)))
    .orderBy(asc(schema.bars.t));

  const series = new Map<string, number[]>();
  for (const r of rows) {
    const arr = series.get(r.symbol) ?? [];
    arr.push(r.c);
    series.set(r.symbol, arr);
  }

  const sparks: Record<string, number[]> = {};
  for (const s of symbols) {
    const full = series.get(s) ?? [];
    if (full.length <= 32) { sparks[s] = full; continue; }
    const step = full.length / 32;
    const sampled: number[] = [];
    for (let i = 0; i < 32; i++) sampled.push(full[Math.floor(i * step)]);
    sampled[31] = full[full.length - 1]; // always end on the latest close
    sparks[s] = sampled;
  }

  return NextResponse.json({ ok: true, sparks });
}
