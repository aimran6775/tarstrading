import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/server/auth";
import { runHeartbeat } from "@/server/heartbeat";

/*
  External trigger for the platform heartbeat (agents 24/7, backfill, session
  sweep — see server/heartbeat.ts). The backend service also self-ticks via
  instrumentation.ts, so this endpoint is optional redundancy for any outside
  scheduler.

  Auth: requires `Authorization: Bearer <CRON_SECRET>`. Fail CLOSED when the
  secret isn't configured — an unauthenticated endpoint that places orders
  would be a real problem.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    /*
      Throttle failed attempts (gap 49). The secret compare is correct, but
      an unlimited endpoint invites offline-speed guessing; 20 failures per
      IP per 10 minutes leaves the scheduler (12 calls/hour, always
      authorised) untouched while making a brute force pointless.
    */
    const h = await headers();
    const allowed = await rateLimit(`cron:${clientIp(h)}`, 20, 10 * 60_000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await runHeartbeat("tick"));
}

// Vercel Cron issues GET; POST is allowed for manual/other schedulers.
export const GET = run;
export const POST = run;
