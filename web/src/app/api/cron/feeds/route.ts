import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/server/auth";
import { feedsFastTick } from "@/server/feeds";

/*
  The fast feeds beat: whole-board delayed-SIP sweep, the 30 live-slot roster,
  and derived index levels. The backend service self-ticks this every 60s via
  instrumentation.ts; the endpoint exists so any external scheduler can drive
  it instead. Same fail-closed auth as /api/cron/tick.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // Same throttle as the tick endpoint (gap 49).
    const h = await headers();
    const allowed = await rateLimit(`cron:${clientIp(h)}`, 20, 10 * 60_000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await feedsFastTick()) });
}

export const GET = run;
export const POST = run;
