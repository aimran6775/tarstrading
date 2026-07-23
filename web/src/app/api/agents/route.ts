import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";
import { recentActivity, describeStrategy, agentPnL, sanitizeStrategy, type Strategy } from "@/server/agents";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const agents = await db.select().from(schema.agents)
    .where(eq(schema.agents.userId, user.id))
    .orderBy(desc(schema.agents.createdAt));
  const enriched = await Promise.all(agents.map(async (a) => ({
    ...a,
    strategy: JSON.parse(a.strategy),
    backtest: a.backtest ? JSON.parse(a.backtest) : null,
    thesis: describeStrategy(JSON.parse(a.strategy) as Strategy),
    // Live realized+unrealized P&L of the agent's tagged book.
    pnl: (a.status === "running" || a.status === "paused" || a.status === "killed")
      ? await agentPnL(user.id, a.id) : 0,
  })));
  return NextResponse.json({ ok: true, agents: enriched, activity: await recentActivity(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json();

  const strategy = sanitizeStrategy(body.strategy);
  if (!strategy) {
    return NextResponse.json(
      { ok: false, error: "An agent needs a universe, at least one entry rule, and at least one exit rule." },
      { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40) || "Unnamed agent";
  const allocation = Math.min(Math.max(Number(body.allocation) || 5000, 500), 50000);
  const maxDrawdown = Math.min(Math.max(Number(body.maxDrawdown) || 0.2, 0.05), 0.5);

  const agent = {
    id: randomUUID(), userId: user.id, name,
    emoji: String(body.emoji ?? "🤖").slice(0, 8),
    strategy: JSON.stringify(strategy),
    allocation, maxDrawdown,
    status: "draft" as const, backtest: null, createdAt: Date.now(),
  };
  await db.insert(schema.agents).values(agent);
  return NextResponse.json({ ok: true, id: agent.id }, { status: 201 });
}
