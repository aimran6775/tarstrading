import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { computeAchievements } from "@/server/achievements";
import { getLeaderboard } from "@/server/leaderboard";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const achievements = computeAchievements(user.id);
  const leaderboard = getLeaderboard(user.id);
  return NextResponse.json({ ok: true, achievements, leaderboard });
}
