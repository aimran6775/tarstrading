import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth";
import { db, schema } from "@/server/db";
import { tickAllRunningAgents } from "@/server/agents";
import { audit } from "@/server/admin-ops";

/*
  One-shot platform operations. Admin-only, audited.
  - flush-quotes: clear the shared L2 quote cache so the next read re-fetches.
  - run-tick: fire the agent heartbeat now (respects the agents-paused switch).
*/
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const op = String((await request.json().catch(() => ({})))?.op ?? "");
  let result: unknown = null;
  switch (op) {
    case "flush-quotes":
      await db.delete(schema.quoteCache);
      break;
    case "run-tick":
      result = await tickAllRunningAgents();
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown op." }, { status: 400 });
  }
  await audit(admin.id, `ops.${op}`, result);
  return NextResponse.json({ ok: true, result });
}
