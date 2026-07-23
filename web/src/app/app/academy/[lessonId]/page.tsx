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

  // If this lesson has the guided-trade widget, fetch the learner's real
  // account server-side so the widget renders their numbers with no client
  // fetch and nothing to hydrate.
  const hasGuidedTrade = found.lesson.sections.some((s) => s.kind === "widget" && s.variant === "first-trade");
  let accountEquity: number | null = null;
  let positionCount = 0;
  if (hasGuidedTrade) {
    const [acct] = await db.select({ equity: schema.accounts.equity })
      .from(schema.accounts).where(eq(schema.accounts.userId, user.id));
    accountEquity = acct?.equity ?? null;
    const pos = await db.select({ id: schema.positions.id })
      .from(schema.positions).where(eq(schema.positions.userId, user.id));
    positionCount = pos.length;
  }

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
        accountEquity={accountEquity}
        positionCount={positionCount}
      />
    </div>
  );
}
