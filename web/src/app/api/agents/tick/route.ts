import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { tickAgents } from "@/server/agents";

/*
  The desk tick: evaluates every running agent for this user. Called by the
  app while it's open (v1's honest contract: your analysts work while the
  desk is staffed; server-side cron ships with deploy).
*/
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const actions = await tickAgents(user.id);
  return NextResponse.json({ ok: true, actions });
}
