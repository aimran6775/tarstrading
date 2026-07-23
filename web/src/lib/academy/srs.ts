/*
  Leitner spaced repetition — the schedule that turns Practice from a shuffle
  into actual learning. Five boxes; a correct recall promotes a card to a
  longer interval, a miss knocks it back to box 1 (see it again today). The
  intervals widen fast enough that a mastered term is asked for a few times a
  month, not every session.
*/

export const MAX_BOX = 5;

/** Days until a card in each box is due again. Box 1 is "again today". */
const INTERVAL_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 };

const DAY_MS = 86_400_000;

/** Deterministic, stable key for a flashcard from its front text — the same
    term appearing in two stages collapses to one review row. */
export function cardKey(front: string): string {
  const s = front.trim().toLowerCase();
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "c" + (h >>> 0).toString(36);
}

export type Review = { box: number; dueAt: number; reps: number; lapses: number };

/** Advance a card's schedule from a recall result. `now` is epoch-ms. */
export function schedule(prev: Review | null, got: boolean, now: number): Review {
  const box = prev?.box ?? 1;
  const nextBox = got ? Math.min(MAX_BOX, box + 1) : 1;
  return {
    box: nextBox,
    dueAt: now + INTERVAL_DAYS[nextBox] * DAY_MS,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (got ? 0 : 1),
  };
}
