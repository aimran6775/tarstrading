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

  const hasTrade = !!db.select().from(schema.orders)
    .where(and(eq(schema.orders.userId, user.id), eq(schema.orders.status, "filled"))).get();
  const hasLesson = !!db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id)).get();
  const hasChat = !!db.select().from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.userId, user.id), eq(schema.chatMessages.role, "user"))).get();
  const hasAgent = !!db.select().from(schema.agents)
    .where(eq(schema.agents.userId, user.id)).get();

  return NextResponse.json({
    ok: true,
    steps: { hasTrade, hasLesson, hasChat, hasAgent },
    done: hasTrade && hasLesson && hasChat && hasAgent,
  });
}
