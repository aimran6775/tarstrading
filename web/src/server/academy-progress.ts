import "server-only";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { allLessons, tracks } from "@/lib/academy";
import type { Lesson } from "@/lib/academy/types";

/*
  One source of truth for a learner's academy standing. The academy home, the
  Floor, and the /api/academy route all derived this independently and could
  drift; now they share this.
*/
export type AcademyProgress = {
  done: Set<string>;
  completed: string[];
  xp: number;
  lessonsDone: number;
  totalLessons: number;
  next: Lesson | null;
  stagesCleared: number;
  totalStages: number;
};

export async function getAcademyProgress(userId: string): Promise<AcademyProgress> {
  const rows = await db.select({ lessonId: schema.lessonProgress.lessonId, xp: schema.lessonProgress.xp })
    .from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId));
  const done = new Set(rows.map((r) => r.lessonId));
  return {
    done,
    completed: [...done],
    xp: rows.reduce((s, r) => s + r.xp, 0),
    lessonsDone: allLessons.filter((l) => done.has(l.id)).length,
    totalLessons: allLessons.length,
    next: allLessons.find((l) => !done.has(l.id)) ?? null,
    stagesCleared: tracks.filter((t) => t.lessons.every((l) => done.has(l.id))).length,
    totalStages: tracks.length,
  };
}
