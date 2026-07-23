/*
  Academy content model, v2. Lessons are DATA; the reader renders them.
  Blocks come in two families:

  - Reading blocks (prose, keyIdea, analogy, formula) carry the idea.
  - Interactive blocks (chart, calc, flashcards, game, desk, quiz) make the
    learner DO something — the point of Academy v2. Never a wall of paragraphs.
*/

// --- reading blocks ---
type Prose = { kind: "prose"; text: string };
type KeyIdea = { kind: "keyIdea"; title: string; text: string };
/** Plain-language "explain-it-to-anyone" analogy — the beginner's on-ramp. */
type Analogy = { kind: "analogy"; title: string; text: string };
type Formula = { kind: "formula"; label: string; expression: string; legend: string };

// --- interactive blocks ---

/** An animated, annotated chart that teaches one idea. */
type ChartBlock = {
  kind: "chart";
  variant: "candle-anatomy" | "sma-cross" | "support-resistance" | "trend" | "spread";
  caption?: string;
};

/** A live calculator: sliders/inputs in, the number out, color-coded. */
type CalcBlock = {
  kind: "calc";
  tool: "position-size" | "risk-reward" | "expectancy" | "compounding";
  title?: string;
};

/** A flip-card deck for the terms this lesson introduced. */
type Flashcards = {
  kind: "flashcards";
  title?: string;
  cards: { front: string; back: string }[];
};

/** A quick interactive drill — learn by deciding, not reading. */
type Game = {
  kind: "game";
  variant: "size-it" | "bull-or-bear" | "spot-the-level" | "order-match";
  title?: string;
};

/** A one-off teaching widget keyed by name (Trading-with-AI, Options, etc.). */
type Widget = {
  kind: "widget";
  variant: "rule-builder" | "overfit" | "payoff" | "tilt" | "checklist"
    | "rsi" | "curve" | "greeks" | "heat" | "correlation";
};

type Quiz = { kind: "quiz"; question: string; choices: string[]; answer: number; explain: string };

/** Sends the learner into the real terminal to do the thing for real. */
type Desk = { kind: "desk"; instruction: string; symbol?: string };

export type Block =
  | Prose | KeyIdea | Analogy | Formula
  | ChartBlock | CalcBlock | Flashcards | Game | Widget | Quiz | Desk;

// Back-compat alias — earlier content authored against `Section`.
export type Section = Block;

export type Lesson = {
  id: string;
  title: string;
  hook: string;         // one sentence that earns the next ten minutes
  minutes: number;
  xp: number;
  sections: Block[];
};

export type Track = {
  id: string;
  title: string;
  tagline: string;
  /** Which instruments/skills this unlocks. */
  covers: string;
  accent: "gold" | "gain" | "agent" | "loss";
  lessons: Lesson[];
};
