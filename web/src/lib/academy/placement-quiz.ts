/*
  Placement test — the escape hatch from sequential gating for people who
  already know the basics. Six questions, one per foundational stage. You're
  placed at the FIRST stage whose question you miss; everything before it is
  marked "tested out" so it unlocks without pretending you earned the XP. Ace
  all six and you skip straight past the fundamentals. Answers are graded on the
  server (see the placement route) so the placement can't be forged.
*/

export type PlacementQuestion = {
  /** The stage this question gates — display only. */
  stage: string;
  prompt: string;
  choices: string[];
  answer: number;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    stage: "Markets 101",
    prompt: "What is the bid-ask spread?",
    choices: [
      "A broker's monthly fee",
      "The gap between the highest price buyers offer and the lowest sellers accept",
      "The difference between yesterday's and today's close",
      "A type of order",
    ],
    answer: 1,
  },
  {
    stage: "Reading Price",
    prompt: "A stock keeps bouncing up off $50 without breaking below it. $50 is acting as…",
    choices: ["Resistance", "Support", "A moving average", "The spread"],
    answer: 1,
  },
  {
    stage: "Orders & Execution",
    prompt: "You want to buy right now, guaranteed to fill, price be damned. Which order?",
    choices: ["Limit", "Stop", "Market", "Trailing stop"],
    answer: 2,
  },
  {
    stage: "Risk & Position Sizing",
    prompt: "$100,000 account, risking 1%, entry $50, stop $48. How many shares?",
    choices: ["1,000", "500", "2,000", "250"],
    answer: 1, // risk $1,000 ÷ $2 per share = 500
  },
  {
    stage: "Building an Edge",
    prompt: "Which system is more profitable over many trades?",
    choices: [
      "Wins 70%, avg win 0.5R, avg loss 1R",
      "Wins 40%, avg win 2.5R, avg loss 1R",
      "They're identical",
      "Can't tell",
    ],
    answer: 1, // 0.4×2.5 − 0.6×1 = +0.40R beats 0.7×0.5 − 0.3×1 = +0.05R
  },
  {
    stage: "Trading Psychology",
    prompt: "You take three losses in a row. What protects the account?",
    choices: [
      "Double your next size to win it back",
      "Keep size the same, or reduce it / stop for the day",
      "Switch to a riskier strategy to catch up",
      "Add to a losing position to average down",
    ],
    answer: 1,
  },
];

/** The stage index to START at: the first question missed, or past them all if
    every answer is correct. Equals the number of stages to mark "tested out". */
export function placeFromAnswers(answers: number[]): number {
  for (let i = 0; i < PLACEMENT_QUESTIONS.length; i++) {
    if (answers[i] !== PLACEMENT_QUESTIONS[i].answer) return i;
  }
  return PLACEMENT_QUESTIONS.length;
}
