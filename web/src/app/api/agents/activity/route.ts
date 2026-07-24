import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { recentActivity } from "@/server/agents";

/*
  Just the desk's activity feed — a cheap read the toast poller hits every 20s,
  instead of the full /api/agents (which re-parses every strategy and re-prices
  every analyst's P&L on each poll).
*/
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, activity: await recentActivity(user.id, 20) });
}
