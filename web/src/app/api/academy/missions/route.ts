import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { gradeAllMissions, checkMission } from "@/server/missions-grader";
import { MISSIONS } from "@/lib/academy/missions";

/*
  GET  → every mission graded against the current account, plus which are banked.
  POST { missionId } → re-grade one mission against FRESH marked equity and bank
  it if it newly passes (the "Check my trade" action).
*/
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  /*
    The grade alone can't be rendered — a client needs the mission's own
    words to show it. Fold the definition in beside the verdict so one
    call is enough for a whole missions screen.
  */
  const graded = await gradeAllMissions(user.id, false);
  const withCopy = graded.map((g) => {
    const m = MISSIONS.find((x) => x.id === g.missionId);
    return {
      ...g,
      title: m?.title ?? g.missionId,
      brief: m?.brief ?? "",
      hint: m?.hint ?? "",
      xp: m?.xp ?? 0,
      lesson: m?.lesson ?? null,
    };
  });
  return NextResponse.json({ ok: true, missions: withCopy });
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
