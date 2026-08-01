import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { findLesson, nextLessonInfo } from "@/lib/academy";

/*
  One lesson, whole — the blocks a client needs to render it natively.

  Quiz ANSWERS are stripped. The server re-grades every submission against
  its own keys (see the POST in ../route.ts), so shipping the answer key to
  a client would be handing out the exam solutions for nothing: the client
  still can't assert a pass.

  GET /api/academy/lesson?id=s1-what-a-market-is
*/
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const found = findLesson(id);
  if (!found) return NextResponse.json({ ok: false, error: "Unknown lesson." }, { status: 404 });

  const { lesson, track } = found;
  const sections = lesson.sections.map((s) => {
    if (s.kind === "quiz") {
      // Question and choices travel; the key stays home.
      const { answer: _answer, ...rest } = s;
      return rest;
    }
    return s;
  });

  return NextResponse.json({
    ok: true,
    lesson: {
      id: lesson.id,
      title: lesson.title,
      hook: lesson.hook,
      minutes: lesson.minutes,
      xp: lesson.xp,
      trackId: track.id,
      trackTitle: track.title,
      sections,
    },
    next: nextLessonInfo(lesson.id)?.lesson.id ?? null,
  });
}
