import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";

const VARIANTS = new Set(["size-it", "bull-or-bear", "spot-the-level", "order-match"]);

/*
  Log one drill attempt — the practice-side companion to quiz grading. Cheap and
  fire-and-forget from the client; it just feeds the admin's drill analytics.
*/
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const variant = String(body?.variant ?? "");
  if (!VARIANTS.has(variant)) return NextResponse.json({ ok: false }, { status: 400 });

  await db.insert(schema.gameAttempts).values({
    id: randomUUID(), userId: user.id, variant,
    correct: body?.correct ? 1 : 0, createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
