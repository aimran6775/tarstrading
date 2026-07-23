import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";

/*
  The four "getting started" milestones, read from data the app already keeps.
  A new trader sees this as a checklist; it disappears once every box is ticked.
*/
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const [trades, lessons, chats, agents] = await Promise.all([
    db.select({ id: schema.orders.id }).from(schema.orders)
      .where(and(eq(schema.orders.userId, user.id), eq(schema.orders.status, "filled"))).limit(1),
    db.select({ id: schema.lessonProgress.id }).from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.userId, user.id)).limit(1),
    db.select({ id: schema.agentChats.id }).from(schema.agentChats)
      .where(and(eq(schema.agentChats.userId, user.id), eq(schema.agentChats.role, "user"))).limit(1),
    db.select({ id: schema.agents.id }).from(schema.agents)
      .where(eq(schema.agents.userId, user.id)).limit(1),
  ]);
  const hasTrade = trades.length > 0;
  const hasLesson = lessons.length > 0;
  const hasChat = chats.length > 0;
  const hasAgent = agents.length > 0;

  return NextResponse.json({
    ok: true,
    steps: { hasTrade, hasLesson, hasChat, hasAgent },
    done: hasTrade && hasLesson && hasChat && hasAgent,
  });
}
