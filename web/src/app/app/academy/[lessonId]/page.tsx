import { currentUser } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { findLesson, nextLesson } from "@/lib/academy";
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

  const next = nextLesson(lessonId);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <LessonReader
        track={{ id: found.track.id, title: found.track.title, accent: found.track.accent }}
        lesson={found.lesson}
        lessonNumber={found.index + 1}
        trackSize={found.track.lessons.length}
        nextLessonId={next?.id ?? null}
      />
    </div>
  );
}
