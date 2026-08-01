import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getAcademyProgress } from "@/server/academy-progress";
import { weakSpots } from "@/server/weak-spots";
import { db, schema } from "@/server/db";
import { and, eq, lte } from "drizzle-orm";
import {
  tracks, allLessons, findLesson, nextLessonInfo, unlockedTrackIds,
  isLessonUnlocked, totalXP,
} from "@/lib/academy";

/*
  THE curriculum, served — so every client teaches the same course.

  The iOS app shipped its own six-track curriculum with its own lesson ids
  and its own device-local progress. That meant two academies: finishing a
  lesson on the web moved nothing on the phone, the XP numbers disagreed,
  and the phone couldn't see missions, placement, practice or reviews at
  all. One course, one progress ledger, two windows onto it.

  This returns STRUCTURE plus the caller's state — enough to render a
  course map, resume where they left off, and know what's locked. Lesson
  BODIES stay behind /api/academy/lesson so a course map costs one small
  payload rather than every word of every lesson.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const now = Date.now();
  const [progress, weak, dueRows] = await Promise.all([
    getAcademyProgress(user.id),
    weakSpots(user.id),
    /* How many terms are due for review right now. The Leitner schedule
       was invisible outside the Practice page, so a learner had no reason
       to come back daily — the one habit the whole method depends on. */
    db.select({ cardKey: schema.cardReviews.cardKey })
      .from(schema.cardReviews)
      .where(and(
        eq(schema.cardReviews.userId, user.id),
        lte(schema.cardReviews.dueAt, now),
      )),
  ]);
  const done = new Set(progress.completed);
  const unlockedTracks = unlockedTrackIds(done);

  const shaped = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    tagline: t.tagline,
    covers: t.covers,
    accent: t.accent,
    unlocked: unlockedTracks.has(t.id),
    lessons: t.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      hook: l.hook,
      minutes: l.minutes,
      xp: l.xp,
      completed: done.has(l.id),
      unlocked: isLessonUnlocked(l.id, done),
      /* What a lesson is MADE of, without its words — lets a client show
         "3 quizzes, a chart and a desk task" before opening it. */
      blocks: l.sections.map((s) => s.kind),
    })),
  }));

  // Where to resume: the last thing they finished points at the next thing.
  const lastDone = progress.completed[progress.completed.length - 1];
  const resume = lastDone ? nextLessonInfo(lastDone) : null;
  const firstUnfinished = allLessons.find((l) => !done.has(l.id));

  return NextResponse.json({
    ok: true,
    tracks: shaped,
    xp: progress.xp,
    totalXP,
    completedCount: done.size,
    lessonCount: allLessons.length,
    /* The two signals the platform collected and never used. */
    reviewsDue: dueRows.length,
    weakSpots: weak,
    resume: (resume?.lesson ?? firstUnfinished)
      ? {
          lessonId: (resume?.lesson ?? firstUnfinished)!.id,
          title: (resume?.lesson ?? firstUnfinished)!.title,
          trackId: findLesson((resume?.lesson ?? firstUnfinished)!.id)?.track.id ?? null,
          newTrack: resume?.newTrack ?? null,
        }
      : null,
  });
}
