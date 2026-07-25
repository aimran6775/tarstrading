import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentAdmin } from "@/server/auth";
import { deepFill, coldSymbols, historianReady } from "@/server/historian";
import { db, schema } from "@/server/db";

/*
  Deep history control. POST fills years of bars for the board (or a given
  symbol list) from Alpaca in batched requests; GET reports what's still cold.
  Long-running by nature — the console shows a progress-ish report when it
  returns.
*/
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const cold = await coldSymbols();
  return NextResponse.json({ ok: true, ready: historianReady, cold, coldCount: cold.length });
}

export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const symbols: string[] | undefined = Array.isArray(body.symbols) ? body.symbols : undefined;
  const years = Number.isFinite(Number(body.years)) ? Math.min(10, Math.max(1, Number(body.years))) : 5;
  // "cold" fills only the symbols with nothing stored — the fast path.
  const list = body.scope === "cold" ? await coldSymbols() : symbols;

  const report = await deepFill(list, years);

  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId: admin.id, action: "historian.deepfill",
    detail: JSON.stringify({ years, scope: body.scope ?? (symbols ? "list" : "board"), ...report }),
    createdAt: Date.now(),
  }).catch(() => {});

  return NextResponse.json({ ok: report.ok, report });
}
