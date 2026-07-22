import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";
import { recentActivity, describeStrategy, agentPnL, type Strategy } from "@/server/agents";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const agents = db.select().from(schema.agents)
    .where(eq(schema.agents.userId, user.id))
    .orderBy(desc(schema.agents.createdAt)).all();
  const enriched = await Promise.all(agents.map(async (a) => ({
    ...a,
    strategy: JSON.parse(a.strategy),
    backtest: a.backtest ? JSON.parse(a.backtest) : null,
    thesis: describeStrategy(JSON.parse(a.strategy) as Strategy),
    // Live realized+unrealized P&L of the agent's tagged book.
    pnl: (a.status === "running" || a.status === "paused" || a.status === "killed")
      ? await agentPnL(user.id, a.id) : 0,
  })));
  return NextResponse.json({ ok: true, agents: enriched, activity: recentActivity(user.id) });
}

const VALID_KINDS = new Set(["price", "sma", "ema", "rsi", "constant"]);
const VALID_COMPARATORS = new Set(["crossesAbove", "crossesBelow", "greaterThan", "lessThan"]);

function sanitizeStrategy(raw: unknown): Strategy | null {
  const s = raw as Strategy;
  if (!s || !Array.isArray(s.universe) || !Array.isArray(s.entry) || !Array.isArray(s.exit)) return null;
  const universe = s.universe.map((x) => String(x).toUpperCase().trim())
    .filter((x) => /^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(x)).slice(0, 6);
  if (!universe.length) return null;
  const cleanRules = (rules: unknown[]): Strategy["entry"] | null => {
    const out = [];
    for (const r of rules.slice(0, 4)) {
      const rule = r as Strategy["entry"][number];
      if (!rule?.lhs || !rule?.rhs || !VALID_KINDS.has(rule.lhs.kind) || !VALID_KINDS.has(rule.rhs.kind)) return null;
      if (!VALID_COMPARATORS.has(rule.comparator)) return null;
      out.push(rule);
    }
    return out;
  };
  const entry = cleanRules(s.entry);
  const exit = cleanRules(s.exit);
  if (!entry?.length || !exit?.length) return null;
  return { universe, entry, exit };
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
  db.insert(schema.agents).values(agent).run();
  return NextResponse.json({ ok: true, id: agent.id }, { status: 201 });
}
