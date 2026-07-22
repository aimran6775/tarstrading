import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  db.delete(schema.priceAlerts).where(and(
    eq(schema.priceAlerts.id, id), eq(schema.priceAlerts.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
