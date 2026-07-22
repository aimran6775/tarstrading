import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { backtest, type Strategy } from "@/server/agents";

/*
  Agent lifecycle. draft → (backtest) → backtested → (run) → running
  ⇄ paused, → killed. The rules the UI enforces are enforced HERE too:
  an agent cannot run without a backtest — no exceptions, that's the
  hiring standard.
*/

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const agent = db.select().from(schema.agents)
    .where(and(eq(schema.agents.id, id), eq(schema.agents.userId, user.id))).get();
  if (!agent) return NextResponse.json({ ok: false }, { status: 404 });

  const { action } = await request.json();

  switch (action) {
    case "backtest": {
      const strategy = JSON.parse(agent.strategy) as Strategy;
      const result = await backtest(strategy);
      if (!result) {
        return NextResponse.json(
          { ok: false, error: "Not enough history for this universe — need at least 60 daily bars." },
          { status: 422 });
      }
      db.update(schema.agents).set({
        backtest: JSON.stringify(result),
        status: agent.status === "running" ? "running" : "backtested",
      }).where(eq(schema.agents.id, id)).run();
      return NextResponse.json({ ok: true, backtest: result });
    }
    case "run": {
      if (!agent.backtest) {
        return NextResponse.json(
          { ok: false, error: "No backtest, no allocation. Run the honest test first." },
          { status: 409 });
      }
      if (agent.status === "killed") {
        return NextResponse.json(
          { ok: false, error: "This agent hit its drawdown limit. Revive it to draft first — deliberately." },
          { status: 409 });
      }
      db.update(schema.agents).set({ status: "running" }).where(eq(schema.agents.id, id)).run();
      db.insert(schema.agentActivity).values({
        id: randomUUID(), userId: user.id, agentId: id, agentName: agent.name,
        text: "Started. Trading within its allocation and drawdown limit.", createdAt: Date.now(),
      }).run();
      return NextResponse.json({ ok: true });
    }
    case "pause": {
      db.update(schema.agents).set({ status: "paused" }).where(eq(schema.agents.id, id)).run();
      db.insert(schema.agentActivity).values({
        id: randomUUID(), userId: user.id, agentId: id, agentName: agent.name,
        text: "Paused by you. Open positions stay open.", createdAt: Date.now(),
      }).run();
      return NextResponse.json({ ok: true });
    }
    case "kill": {
      db.update(schema.agents).set({ status: "killed" }).where(eq(schema.agents.id, id)).run();
      db.insert(schema.agentActivity).values({
        id: randomUUID(), userId: user.id, agentId: id, agentName: agent.name,
        text: "Kill switch pulled. It will never trade again unless you revive it as a draft.", createdAt: Date.now(),
      }).run();
      return NextResponse.json({ ok: true });
    }
    case "revive": {
      db.update(schema.agents).set({ status: "draft", backtest: null }).where(eq(schema.agents.id, id)).run();
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const agent = db.select().from(schema.agents)
    .where(and(eq(schema.agents.id, id), eq(schema.agents.userId, user.id))).get();
  if (!agent) return NextResponse.json({ ok: false }, { status: 404 });
  if (agent.status === "running") {
    return NextResponse.json(
      { ok: false, error: "Pause or kill a running agent before deleting it." }, { status: 409 });
  }
  db.delete(schema.agentActivity).where(eq(schema.agentActivity.agentId, id)).run();
  db.delete(schema.agents).where(eq(schema.agents.id, id)).run();
  return NextResponse.json({ ok: true });
}
