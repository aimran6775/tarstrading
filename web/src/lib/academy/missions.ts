/*
  Graded sim missions — where the academy meets the desk. A mission isn't
  finished when you pass a quiz; it's finished when you place a real (simulated)
  trade that demonstrates the PROCESS the lessons teach: sized from a stop,
  risk capped, heat controlled. The grader (server) reads your actual account —
  positions, stop orders, closed trades — and checks the behavior, never the
  outcome. Client-safe data only; the logic lives in server/missions-grader.
*/

export type MissionKey = "round-trip" | "sized-stop" | "heat";

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
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
export const totalMissionXP = MISSIONS.reduce((s, m) => s + m.xp, 0);

/** One graded criterion in a mission check. */
export type MissionCheck = { label: string; ok: boolean; detail?: string };
export type MissionResult = { passed: boolean; checks: MissionCheck[] };
