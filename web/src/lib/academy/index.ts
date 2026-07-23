import type { Lesson, Track } from "./types";
import { marketsTrack } from "./stage1";
import { readingTrack } from "./stage2";
import { ordersTrack } from "./stage3";
import { riskStage } from "./stage4";
import { edgeStage } from "./stage5";
import { stocksTrack } from "./content1";
import { optionsTrack, futuresTrack, fundTrack } from "./content2";

/*
  The stages of the academy, in order. Stages 1-3 are the rebuilt, fully-
  interactive template (charts you drive, calculators you drag, drills you
  play); the remaining stages carry the v1 content and are being upgraded to
  the same standard, stage by stage. INTERACTIVE_THROUGH marks how far the
  rebuild has reached so the home can badge them.
*/
export const INTERACTIVE_THROUGH = 5;

export const tracks: Track[] = [
  marketsTrack,   // Stage 1 — interactive
  readingTrack,   // Stage 2 — interactive
  ordersTrack,    // Stage 3 — interactive
  riskStage,      // Stage 4 — interactive
  edgeStage,      // Stage 5 — interactive
  stocksTrack,    // Stage 6
  optionsTrack,   // Stage 7
  futuresTrack,   // Stage 8
  fundTrack,      // Stage 9
];

export const allLessons: Lesson[] = tracks.flatMap((t) => t.lessons);

export function findLesson(id: string): { track: Track; lesson: Lesson; index: number } | null {
  for (const track of tracks) {
    const index = track.lessons.findIndex((l) => l.id === id);
    if (index >= 0) return { track, lesson: track.lessons[index], index };
  }
  return null;
}

export function nextLesson(id: string): Lesson | null {
  const flat = allLessons;
  const i = flat.findIndex((l) => l.id === id);
  return i >= 0 && i < flat.length - 1 ? flat[i + 1] : null;
}

/** The next lesson plus whether it begins a new track (so the CTA can say so). */
export function nextLessonInfo(id: string): { lesson: Lesson; newTrack: string | null } | null {
  const next = nextLesson(id);
  if (!next) return null;
  const cur = findLesson(id);
  const nxt = findLesson(next.id);
  const newTrack = cur && nxt && cur.track.id !== nxt.track.id ? nxt.track.title : null;
  return { lesson: next, newTrack };
}

export const totalXP = allLessons.reduce((sum, l) => sum + l.xp, 0);

export type { Lesson, Track, Section } from "./types";
