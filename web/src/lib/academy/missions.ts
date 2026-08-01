/*
  Graded sim missions — where the academy meets the desk. A mission isn't
  finished when you pass a quiz; it's finished when you place a real (simulated)
  trade that demonstrates the PROCESS the lessons teach: sized from a stop,
  risk capped, heat controlled. The grader (server) reads your actual account —
  positions, stop orders, closed trades — and checks the behavior, never the
  outcome. Client-safe data only; the logic lives in server/missions-grader.
*/

export type MissionKey =
  | "round-trip" | "sized-stop" | "heat"
  | "work-a-limit" | "spread-it" | "write-the-why" | "hire-one";

export type Mission = {
  id: string;
  key: MissionKey;
  title: string;
  brief: string;
  /** Concrete how-to shown when the mission is open. */
  hint: string;
  xp: number;
  /** The lesson whose skill this proves — deep-linked for a refresher. */
  lesson: string;
};

export const MISSIONS: Mission[] = [
  {
    id: "mi-round-trip",
    key: "round-trip",
    title: "Your first round trip",
    brief: "Open a position on the desk, then close it. Feel the whole loop — entry to exit — with nothing but practice money on the line.",
    hint: "On the desk, buy any symbol, then sell it back. That out-and-back is a round trip, and it's logged to your journal automatically.",
    xp: 60,
    lesson: "m4-stay-alive",
  },
  {
    id: "mi-sized-stop",
    key: "sized-stop",
    title: "Sized and stopped",
    brief: "Open a position and protect it with a stop, risking no more than 1% of your account. This is the habit every surviving trader has.",
    hint: "Buy a position, then place a SELL · STOP below your entry. Size it so (entry − stop) × shares is about 1% of your equity — the position-size formula, live.",
    xp: 120,
    lesson: "r1-risk-per-trade",
  },
  {
    id: "mi-heat",
    key: "heat",
    title: "Heat under control",
    brief: "Hold two or more positions at once, each protected by a stop, and keep your total open risk under 6% of the account.",
    hint: "Every open position needs its own protective stop. Add up the risk across all of them — keep the sum under 6% of your equity.",
    xp: 150,
    lesson: "r4-portfolio-heat",
  },
  {
    id: "mi-work-a-limit",
    key: "work-a-limit",
    title: "Work an order",
    brief: "Fill a limit order instead of taking whatever the market offers. Naming your price is the difference between trading and reacting.",
    hint: "Open a ticket, switch from Market to Limit, and set a price better than the current one. It rests until the market comes to you — and it may never fill. That is the trade-off.",
    xp: 80,
    lesson: "o1-three-orders",
  },
  {
    id: "mi-spread-it",
    key: "spread-it",
    title: "Spread the risk",
    brief: "Hold three positions with no single one taking over half the book. Concentration is how good traders have bad years.",
    hint: "Buy two more symbols in different corners of the desk. The check measures each position against your gross exposure, so size matters as much as count.",
    xp: 100,
    lesson: "r4-portfolio-heat",
  },
  {
    id: "mi-write-the-why",
    key: "write-the-why",
    title: "Write the why",
    brief: "Close a trade with a written thesis. A trade without a recorded reason teaches you nothing once it is over.",
    hint: "When you close a position the desk asks for your reasoning. Twenty words is enough — what you expected, and what would have proved you wrong.",
    xp: 90,
    lesson: "e3-process",
  },
  {
    id: "mi-hire-one",
    key: "hire-one",
    title: "Hire your first analyst",
    brief: "Turn a plain-English idea into a tested rule running on your floor. This is where the AI half of the platform starts.",
    hint: "Tell the assistant a strategy in your own words. It writes the rules, backtests them out-of-sample, and only then offers to run it.",
    xp: 110,
    lesson: "ai2-plain-english-to-rules",
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
export const totalMissionXP = MISSIONS.reduce((s, m) => s + m.xp, 0);

/** One graded criterion in a mission check. */
export type MissionCheck = { label: string; ok: boolean; detail?: string };
export type MissionResult = { passed: boolean; checks: MissionCheck[] };
