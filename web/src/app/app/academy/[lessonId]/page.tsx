import { currentUser } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { findLesson, nextLessonInfo, isLessonUnlocked } from "@/lib/academy";
import AppNav from "@/components/app-nav";
import LessonReader from "./reader";

export async function generateMetadata(props: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await props.params;
  const found = findLesson(lessonId);
  return { title: found ? found.lesson.title : "Lesson" };
}

export default async function LessonPage(props: { params: Promise<{ lessonId: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { lessonId } = await props.params;
  const found = findLesson(lessonId);
  if (!found) notFound();

  // Gate: you can't skip ahead. Finish the prior stage first.
  const rows = await db.select({ lessonId: schema.lessonProgress.lessonId })
    .from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, user.id));
  const done = new Set(rows.map((r) => r.lessonId));
  if (!isLessonUnlocked(lessonId, done)) redirect("/app/academy");

  const next = nextLessonInfo(lessonId);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <LessonReader
        track={{ id: found.track.id, title: found.track.title, accent: found.track.accent }}
        lesson={found.lesson}
        lessonNumber={found.index + 1}
        trackSize={found.track.lessons.length}
        nextLessonId={next?.lesson.id ?? null}
        nextTrackTitle={next?.newTrack ?? null}
      />
    </div>
  );
}
