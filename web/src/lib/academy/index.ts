import type { Lesson, Track } from "./types";
import { marketsTrack } from "./stage1";
import { readingTrack } from "./stage2";
import { ordersTrack } from "./stage3";
import { riskStage } from "./stage4";
import { edgeStage } from "./stage5";
import { psychologyStage } from "./stage_mind";
import { stocksStage } from "./stage6";
import { optionsStage } from "./stage7";
import { futuresStage } from "./stage8";
import { aiStage } from "./stage9";
import { fundStage } from "./stage10";
import { worldStage } from "./stage11";
import { marginStage } from "./stage12";

/*
  The stages of the academy, in order — every one fully interactive: charts you
  drive, calculators you drag, drills you play, a quiz you must pass to advance.
*/
export const tracks: Track[] = [
  marketsTrack,     // Stage 1
  readingTrack,     // Stage 2
  ordersTrack,      // Stage 3
  riskStage,        // Stage 4
  edgeStage,        // Stage 5
  psychologyStage,  // Stage 6 — the inner game
  stocksStage,      // Stage 7
  optionsStage,     // Stage 8
  futuresStage,     // Stage 9
  aiStage,          // Stage 10
  fundStage,        // Stage 11
  worldStage,       // Stage 12 — the wider universe of instruments
  marginStage,      // Stage 13 — the margin desk: borrowing, SPAN, calls
];

/** Map a concept → the lesson that teaches it, for contextual "Learn" links
    scattered through the app (terminal, ticket, assistant). */
export const CONCEPT_LESSON: Record<string, { id: string; label: string }> = {
  chart: { id: "p1-timeframes", label: "Reading charts" },
  candles: { id: "m3-reading-a-chart", label: "Reading a candle" },
  orders: { id: "o1-three-orders", label: "Order types" },
  sizing: { id: "r1-risk-per-trade", label: "Position sizing" },
  stop: { id: "o3-stops", label: "Using a stop" },
  spread: { id: "o2-slippage", label: "Spread & slippage" },
  ai: { id: "ai1-what-ai-can-do", label: "Trading with AI" },
  backtest: { id: "ai3-honest-backtest", label: "Honest backtesting" },
  options: { id: "op1-calls-puts", label: "How options work" },
  psychology: { id: "mind1-the-enemy-is-you", label: "The inner game" },
  tilt: { id: "mind2-tilt", label: "Tilt & revenge trading" },
  indicators: { id: "p5-momentum", label: "Indicators & RSI" },
  heat: { id: "r4-portfolio-heat", label: "Portfolio heat" },
  adr: { id: "w1-adrs", label: "ADRs & foreign shares" },
  global: { id: "w2-country-funds", label: "Country & region funds" },
  preferred: { id: "w3-preferred", label: "Preferred shares" },
  cef: { id: "w4-closed-end-funds", label: "Closed-end funds" },
  fx: { id: "w5-fx-pairs", label: "How currency pairs work" },
};

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

/** Which stages are open, given what's complete. Stage 1 is always open; each
    later stage unlocks only when every lesson in the one before it is done — a
    real progression, not a cosmetic order. Placement (elsewhere) can grant an
    earlier jump. */
export function unlockedTrackIds(done: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < tracks.length; i++) {
    if (i === 0) { ids.add(tracks[i].id); continue; }
    const prevComplete = tracks[i - 1].lessons.every((l) => done.has(l.id));
    if (prevComplete) ids.add(tracks[i].id);
    else break; // once a stage is locked, everything after it is too
  }
  return ids;
}

/** Is this specific lesson reachable yet? */
export function isLessonUnlocked(lessonId: string, done: Set<string>): boolean {
  const found = findLesson(lessonId);
  return found ? unlockedTrackIds(done).has(found.track.id) : false;
}

export const totalXP = allLessons.reduce((sum, l) => sum + l.xp, 0);

/** Sum of every lesson's own time estimate — the honest basis for any
    "about N hours" claim, so the number moves with the content. */
export const totalMinutes = allLessons.reduce((sum, l) => sum + l.minutes, 0);

export type { Lesson, Track, Section } from "./types";
