import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { scenarioById } from "@/lib/academy/scenarios";

/*
  GET  → the learner's best result per replayed scenario.
  POST { scenarioId, playerReturn, buyHoldReturn } → record a completed replay,
  keeping the best player return and banking XP once. Returns are recomputed
  bounds-checked (a scenario can't move more than its own bars allow), so a
  forged POST can't inflate a leaderboard.
*/

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await db.select().from(schema.replayResults)
    .where(eq(schema.replayResults.userId, user.id));
  return NextResponse.json({ ok: true, results: rows });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const scenario = scenarioById(String(body?.scenarioId ?? ""));
  if (!scenario) return NextResponse.json({ ok: false, error: "Unknown scenario." }, { status: 404 });

  // Clamp to what the scenario could actually have produced — no fabricated wins.
  const lo = Math.min(...scenario.bars.map((b) => b.l));
  const hi = Math.max(...scenario.bars.map((b) => b.h));
  const maxUp = hi / scenario.startPrice - 1;
  const maxDown = lo / scenario.startPrice - 1;
  const clamp = (n: number) => Math.max(maxDown - 0.001, Math.min(maxUp + 0.001, Number(n) || 0));
  const playerReturn = clamp(body?.playerReturn);
  const buyHoldReturn = clamp(body?.buyHoldReturn);

  const [existing] = await db.select().from(schema.replayResults)
    .where(and(eq(schema.replayResults.userId, user.id), eq(schema.replayResults.scenarioId, scenario.id)));

  const now = Date.now();
  if (!existing) {
    await db.insert(schema.replayResults).values({
      id: randomUUID(), userId: user.id, scenarioId: scenario.id,
      playerReturn, buyHoldReturn, completedAt: now, xp: scenario.xp,
    }).onConflictDoNothing();
    return NextResponse.json({ ok: true, xpAwarded: scenario.xp, best: playerReturn });
  }

  // Keep the best attempt; never re-award XP.
  if (playerReturn > existing.playerReturn) {
    await db.update(schema.replayResults)
      .set({ playerReturn, buyHoldReturn, completedAt: now })
      .where(eq(schema.replayResults.id, existing.id));
  }
  return NextResponse.json({ ok: true, xpAwarded: 0, best: Math.max(playerReturn, existing.playerReturn) });
}
