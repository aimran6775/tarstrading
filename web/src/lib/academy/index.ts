import type { Lesson, Track } from "./types";
import { marketsTrack } from "./stage1";
import { readingTrack } from "./stage2";
import { ordersTrack } from "./stage3";
import { riskStage } from "./stage4";
import { edgeStage } from "./stage5";
import { stocksStage } from "./stage6";
import { optionsStage } from "./stage7";
import { futuresStage } from "./stage8";
import { aiStage } from "./stage9";
import { fundStage } from "./stage10";

/*
  The ten stages of the academy, in order. The rebuilt, fully-interactive
  stages (charts you drive, calculators you drag, drills you play) are marked
  in INTERACTIVE_IDS so the home can badge them; the rest carry v1 content and
  are being upgraded to the same standard, stage by stage.
*/
export const tracks: Track[] = [
  marketsTrack,   // Stage 1
  readingTrack,   // Stage 2
  ordersTrack,    // Stage 3
  riskStage,      // Stage 4
  edgeStage,      // Stage 5
  stocksStage,    // Stage 6
  optionsStage,   // Stage 7
  futuresStage,   // Stage 8
  aiStage,        // Stage 9
  fundStage,      // Stage 10
];

// Every stage is now the rebuilt, fully-interactive template.
export const INTERACTIVE_IDS = new Set(tracks.map((t) => t.id));

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

export const totalXP = allLessons.reduce((sum, l) => sum + l.xp, 0);

export type { Lesson, Track, Section } from "./types";
