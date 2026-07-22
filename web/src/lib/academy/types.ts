/*
  Academy content model. Lessons are data, the reader renders them.
  Sections are deliberately few in kind — prose does the teaching, keyIdea
  crystallizes, formula shows the one equation that matters, quiz checks,
  and desk sends the learner to the terminal to DO it.
*/

export type Section =
  | { kind: "prose"; text: string }
  | { kind: "keyIdea"; title: string; text: string }
  | { kind: "formula"; label: string; expression: string; legend: string }
  | { kind: "quiz"; question: string; choices: string[]; answer: number; explain: string }
  | { kind: "desk"; instruction: string; symbol?: string };

export type Lesson = {
  id: string;
  title: string;
  hook: string;         // one sentence that earns the next ten minutes
  minutes: number;
  xp: number;
  sections: Section[];
};

export type Track = {
  id: string;
  title: string;
  tagline: string;
  /** Which instruments this unlocks understanding of. */
  covers: string;
  accent: "gold" | "gain" | "agent" | "loss";
  lessons: Lesson[];
};
