import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentAdmin } from "@/server/auth";
import { backfillTick } from "@/server/backfill";
import { db, schema } from "@/server/db";

/** Admin-triggered healing pass. Every use lands in the audit log. */
export async function POST() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const report = await backfillTick(4);
  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId: admin.id, action: "backfill",
    detail: JSON.stringify(report), createdAt: Date.now(),
  }).catch(() => {});
  return NextResponse.json({ ok: true, report });
}
