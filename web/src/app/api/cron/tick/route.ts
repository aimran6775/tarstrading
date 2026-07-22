import { NextResponse } from "next/server";
import { tickAllRunningAgents } from "@/server/agents";
import { purgeExpiredSessions } from "@/server/auth";

/*
  The server-side heartbeat. A scheduled job (Vercel Cron, Supabase pg_cron, or
  any external scheduler) hits this so agents run 24/7 and sessions are swept
  even when no browser is open.

  Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron attaches
  this header automatically when CRON_SECRET is set in the project env. If no
  secret is configured we refuse (fail CLOSED) — an unauthenticated public
  endpoint that places orders would be a real problem.

  Scheduled via vercel.json; on Supabase, a pg_cron job can `net.http_get` it.
*/

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const [agents] = await Promise.all([
    tickAllRunningAgents(),
    purgeExpiredSessions(),
  ]);
  return NextResponse.json({ ok: true, ...agents, at: Date.now() });
}

// Vercel Cron issues GET; POST is allowed for manual/other schedulers.
export const GET = run;
export const POST = run;
