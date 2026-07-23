import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { tickAllRunningAgents } from "@/server/agents";
import { purgeExpiredSessions } from "@/server/auth";
import { backfillTick } from "@/server/backfill";
import { db, schema } from "@/server/db";

/*
  The server-side heartbeat. A scheduled job (Vercel Cron, Supabase pg_cron, or
  any external scheduler) hits this so agents run 24/7, the bar store heals in
  the background, and sessions are swept — all browser-independent.

  Auth: requires `Authorization: Bearer <CRON_SECRET>`. Fail CLOSED when the
  secret isn't configured — an unauthenticated endpoint that places orders
  would be a real problem. Every run is written to cron_runs for the admin
  dashboard.
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

  const t0 = Date.now();
  let ok = 1;
  let agents = { users: 0, actions: 0 };
  let backfill: Awaited<ReturnType<typeof backfillTick>> | null = null;
  try {
    [agents, backfill] = await Promise.all([
      tickAllRunningAgents(),
      backfillTick(),
      purgeExpiredSessions(),
    ]).then(([a, b]) => [a, b] as const);
  } catch {
    ok = 0;
  }

  const ms = Date.now() - t0;
  await db.insert(schema.cronRuns).values({
    id: randomUUID(), kind: "tick", users: agents.users, actions: agents.actions,
    ms, ok, detail: backfill ? JSON.stringify(backfill) : null, createdAt: Date.now(),
  }).catch(() => {});

  return NextResponse.json({ ok: ok === 1, ...agents, backfill, ms, at: Date.now() });
}

// Vercel Cron issues GET; POST is allowed for manual/other schedulers.
export const GET = run;
export const POST = run;
