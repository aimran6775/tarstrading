import type { Lesson, Track } from "./types";
import { foundationsTrack, priceTrack, riskTrack, stocksTrack } from "./content1";
import { optionsTrack, futuresTrack, fundTrack } from "./content2";

export const tracks: Track[] = [
  foundationsTrack,
  priceTrack,
  riskTrack,
  stocksTrack,
  optionsTrack,
  futuresTrack,
  fundTrack,
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

export const totalXP = allLessons.reduce((sum, l) => sum + l.xp, 0);

export type { Lesson, Track, Section } from "./types";
