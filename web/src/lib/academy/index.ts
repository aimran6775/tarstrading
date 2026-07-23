import type { Lesson, Track } from "./types";
import { marketsTrack } from "./stage1";
import { priceTrack, riskTrack, stocksTrack } from "./content1";
import { optionsTrack, futuresTrack, fundTrack } from "./content2";

/*
  The stages of the academy, in order. Stage 1 (Markets 101) is the rebuilt,
  fully-interactive template; the remaining stages carry the v1 content and are
  being upgraded to the same interactive standard stage by stage.
*/
export const tracks: Track[] = [
  marketsTrack,   // Stage 1 — interactive
  priceTrack,     // Stage 2
  riskTrack,      // Stage 3
  stocksTrack,    // Stage 4
  optionsTrack,   // Stage 5
  futuresTrack,   // Stage 6
  fundTrack,      // Stage 7
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
