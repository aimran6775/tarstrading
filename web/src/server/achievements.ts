import "server-only";
import { db, schema } from "./db";
import { and, eq } from "drizzle-orm";
import { STARTING_CASH } from "./auth";

/*
  Achievements — earned, never granted. Every badge is DERIVED from what a
  trader actually did (fills, closed P&L, lessons, agents), recomputed on
  read. Nothing is stored, so there's no state to drift out of sync and no
  way to award something the record doesn't support. Locked badges show the
  bar so progress is always legible.
*/

export type Tier = "bronze" | "silver" | "gold";
export type Badge = {
  id: string;
  name: string;
  blurb: string;
  tier: Tier;
  /** 0..1 progress toward earning. 1 means earned. */
  progress: number;
  earned: boolean;
  /** Human progress label, e.g. "7 / 10 trades". */
  detail: string;
};

/** Longest run of consecutive winning closed trades (oldest → newest). */
function longestWinStreak(pnls: number[]): number {
  let best = 0, run = 0;
  for (const p of pnls) {
    if (p > 0) { run += 1; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

export async function computeAchievements(userId: string): Promise<{ badges: Badge[]; earned: number; total: number }> {
  const [filled, journal, lessons, agents, chats, alerts, accountRows] = await Promise.all([
    db.select().from(schema.orders)
      .where(and(eq(schema.orders.userId, userId), eq(schema.orders.status, "filled"))),
    db.select().from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId)),
    db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId)),
    db.select().from(schema.agents).where(eq(schema.agents.userId, userId)),
    db.select().from(schema.chatMessages).where(eq(schema.chatMessages.userId, userId)),
    db.select().from(schema.priceAlerts).where(eq(schema.priceAlerts.userId, userId)),
    db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)),
  ]);
  const account = accountRows[0];

  const fills = filled.length;
  const closed = journal.filter((j) => j.pnl != null).sort((a, b) => a.createdAt - b.createdAt);
  const wins = closed.filter((j) => (j.pnl ?? 0) > 0).length;
  const streak = longestWinStreak(closed.map((j) => j.pnl ?? 0));
  const symbols = new Set(filled.map((o) => o.symbol)).size;
  const xp = lessons.reduce((s, l) => s + l.xp, 0);
  const lessonCount = lessons.length;
  const agentCount = agents.length;
  const liveAgent = agents.some((a) => a.status === "running" || a.status === "paused" || a.status === "killed");
  const equity = account?.equity ?? STARTING_CASH;
  const returnPct = (equity - STARTING_CASH) / STARTING_CASH;
  const chatCount = chats.filter((c) => c.role === "user").length;

  // Each badge: a target, a current value, and how to phrase it.
  const specs: Array<[string, string, string, Tier, number, number, string]> = [
    // id, name, blurb, tier, value, target, unit
    ["first-print", "First Print", "Place your first filled order.", "bronze", fills, 1, "trade"],
    ["active-desk", "Active Desk", "Fill 10 orders.", "silver", fills, 10, "trades"],
    ["market-maker", "Market Maker", "Fill 50 orders.", "gold", fills, 50, "trades"],
    ["green-day", "Green Day", "Close your first winning trade.", "bronze", wins, 1, "win"],
    ["on-a-heater", "On a Heater", "Win 3 closed trades in a row.", "silver", streak, 3, "streak"],
    ["diversified", "Diversified", "Trade 5 different symbols.", "silver", symbols, 5, "symbols"],
    ["up-ten", "Up 10%", "Grow the book 10% above start.", "silver", Math.max(returnPct / 0.10, 0), 1, "pct"],
    ["doubled", "Doubled Down", "Grow the book to 2×.", "gold", Math.max(returnPct / 1.0, 0), 1, "pct"],
    ["first-class", "First Class", "Complete your first lesson.", "bronze", lessonCount, 1, "lesson"],
    ["scholar", "Scholar", "Complete 10 lessons.", "silver", lessonCount, 10, "lessons"],
    ["dean", "Dean's List", "Earn 1,000 XP.", "gold", xp, 1000, "xp"],
    ["quant", "Quant", "Build your first agent.", "bronze", agentCount, 1, "agent"],
    ["automated", "Automated", "Put an agent on the desk.", "silver", liveAgent ? 1 : 0, 1, "agent"],
    ["met-tars", "Met Tars", "Ask Tars a question.", "bronze", chatCount, 1, "chat"],
    ["on-watch", "On Watch", "Set a price alert.", "bronze", alerts.length, 1, "alert"],
  ];

  const badges: Badge[] = specs.map(([id, name, blurb, tier, value, target, unit]) => {
    const progress = Math.min(value / target, 1);
    const earned = progress >= 1;
    let detail: string;
    if (unit === "pct") {
      detail = earned ? "Earned" : `${(returnPct * 100).toFixed(1)}% of book`;
    } else if (unit === "xp") {
      detail = `${Math.min(Math.floor(value), target)} / ${target} XP`;
    } else {
      const shown = Math.min(Math.floor(value), target);
      detail = earned ? "Earned" : `${shown} / ${target} ${unit}`;
    }
    return { id, name, blurb, tier, progress, earned, detail };
  });

  return { badges, earned: badges.filter((b) => b.earned).length, total: badges.length };
}
