import { NextResponse } from "next/server";
import { currentUser, rateLimit } from "@/server/auth";
import { tutorReply, type TutorMsg } from "@/server/tutor";

/*
  One tutor turn. POST { lessonId, messages } → the tutor's next reply, grounded
  in that lesson and the learner's own weak spots. Rate-limited per user because
  each turn costs a model call.
*/
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // ~20 turns/min per learner — plenty for study, a ceiling on abuse/cost.
  if (!(await rateLimit(`tutor:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "Slow down a moment — the tutor's catching up." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const lessonId = String(body?.lessonId ?? "");
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: TutorMsg[] = raw
    .filter((m: unknown): m is TutorMsg =>
      !!m && typeof m === "object" && (( m as TutorMsg).role === "user" || (m as TutorMsg).role === "assistant") && typeof (m as TutorMsg).content === "string")
    .slice(-10);

  if (!lessonId || messages.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to answer." }, { status: 400 });
  }

  const { reply, grounded } = await tutorReply(user.id, lessonId, messages);
  return NextResponse.json({ ok: true, reply, grounded });
}
