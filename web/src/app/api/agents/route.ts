import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, desc, eq } from "drizzle-orm";
import { recentActivity, describeStrategy, agentPnL, sanitizeStrategy, type Strategy } from "@/server/agents";
import { ANALYST_PRESETS, presetByKey } from "@/server/presets";

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
  return NextResponse.json({
    ok: true, agents: enriched, activity: await recentActivity(user.id),
    // The bench: hire-in-one-click archetypes, served with the floor so the
    // UI never hardcodes a strategy.
    bench: ANALYST_PRESETS.map((p) => ({
      key: p.key, name: p.name, sigil: p.sigil, creed: p.creed, method: p.method,
      allocation: p.allocation, maxDrawdown: p.maxDrawdown,
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json();

  // One-click hire from the bench: the preset IS the strategy — the client
  // sends only a key, so a tampered payload can't smuggle different rules
  // under a trusted name.
  if (typeof body.preset === "string") {
    const preset = presetByKey(body.preset);
    if (!preset) return NextResponse.json({ ok: false, error: "No such archetype." }, { status: 400 });
    const existing = await db.select({ name: schema.agents.name }).from(schema.agents)
      .where(eq(schema.agents.userId, user.id));
    const taken = new Set(existing.map((a) => a.name));
    let name = preset.name;
    for (let n = 2; taken.has(name); n++) name = `${preset.name} ${n}`;
    const agent = {
      id: randomUUID(), userId: user.id, name,
      emoji: preset.sigil, // the column predates sigils; it now carries the mark's key
      strategy: JSON.stringify(preset.strategy),
      allocation: preset.allocation, maxDrawdown: preset.maxDrawdown,
      status: "draft" as const, backtest: null, createdAt: Date.now(),
    };
    await db.insert(schema.agents).values(agent);
    return NextResponse.json({ ok: true, id: agent.id, name }, { status: 201 });
  }

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
    // Hand-built strategies wear the custom signet; the legacy emoji column
    // now carries sigil keys (see components/analyst-sigil.tsx).
    emoji: "custom",
    strategy: JSON.stringify(strategy),
    allocation, maxDrawdown,
    status: "draft" as const, backtest: null, createdAt: Date.now(),
  };
  await db.insert(schema.agents).values(agent);
  return NextResponse.json({ ok: true, id: agent.id }, { status: 201 });
}

/** Floor-wide switches: pause everything / resume everything, one call.
    Resume only lifts what pause set down — killed analysts stay killed,
    drafts stay drafts; a master switch must never quietly deploy anyone. */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.action === "pauseAll") {
    const rows = await db.update(schema.agents).set({ status: "paused" })
      .where(and(eq(schema.agents.userId, user.id), eq(schema.agents.status, "running")))
      .returning({ id: schema.agents.id });
    return NextResponse.json({ ok: true, changed: rows.length });
  }
  if (body.action === "resumeAll") {
    // Paused analysts were running before, so the no-backtest gate already
    // passed them once; resume only flips paused → running, nothing else.
    const rows = await db.update(schema.agents).set({ status: "running" })
      .where(and(eq(schema.agents.userId, user.id), eq(schema.agents.status, "paused")))
      .returning({ id: schema.agents.id });
    return NextResponse.json({ ok: true, changed: rows.length });
  }
  return NextResponse.json({ ok: false, error: "Unknown floor action." }, { status: 400 });
}
