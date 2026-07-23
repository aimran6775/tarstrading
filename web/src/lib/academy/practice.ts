import { tracks } from "./index";

/*
  The practice layer — everything the ten stages taught, recycled into an
  endless review loop. We harvest every flashcard the lessons defined (single
  source of truth: write a card once in a lesson, it shows up here too) and
  expose the game roster. No new content to maintain — it all derives from the
  stages.
*/

export type Term = { front: string; back: string; stage: string; stageId: string };

/** Every flashcard across every stage, tagged with where it came from. */
export function allTerms(): Term[] {
  const out: Term[] = [];
  for (const track of tracks) {
    for (const lesson of track.lessons) {
      for (const block of lesson.sections) {
        if (block.kind === "flashcards") {
          for (const c of block.cards) {
            out.push({ front: c.front, back: c.back, stage: track.title, stageId: track.id });
          }
        }
      }
    }
  }
  return out;
}

/** Terms for one stage (for "review this stage" decks). */
export function termsForStage(stageId: string): Term[] {
  return allTerms().filter((t) => t.stageId === stageId);
}

export type GameDef = {
  variant: "size-it" | "bull-or-bear" | "spot-the-level" | "order-match";
  title: string;
  blurb: string;
};

/** The arcade roster — the same drills the lessons use, gathered in one place. */
export const GAMES: GameDef[] = [
  { variant: "size-it", title: "Size It", blurb: "Given an account, risk, and stop — pick the right share count. The survival skill, drilled." },
  { variant: "bull-or-bear", title: "Read the Structure", blurb: "Uptrend, downtrend, or range? Train your eye to read price at a glance." },
  { variant: "spot-the-level", title: "Spot the Level", blurb: "Tap where support is. Find the floors and ceilings that matter." },
  { variant: "order-match", title: "Order Match", blurb: "Match each job to the right order type — market, limit, or stop." },
];
