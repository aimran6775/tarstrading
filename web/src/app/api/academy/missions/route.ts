import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { gradeAllMissions, checkMission } from "@/server/missions-grader";

/*
  GET  → every mission graded against the current account, plus which are banked.
  POST { missionId } → re-grade one mission against FRESH marked equity and bank
  it if it newly passes (the "Check my trade" action).
*/
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, missions: await gradeAllMissions(user.id, false) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const missionId = String(body?.missionId ?? "");
  const result = await checkMission(user.id, missionId);
  if (!result) return NextResponse.json({ ok: false, error: "Unknown mission." }, { status: 404 });

  return NextResponse.json({ ok: true, result });
}
