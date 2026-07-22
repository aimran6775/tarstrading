import "server-only";
import { db, schema } from "./db";
import { desc, eq } from "drizzle-orm";
import { STARTING_CASH } from "./auth";

/*
  Leaderboard — everyone started with the same $100k, so the only fair
  ranking is return on that stake. We rank on the cached mark-to-market
  equity (kept fresh by markEquity on every poll), so this is a fast read
  with no quotes fetched here. First names only; no emails leave the server.
*/

export type Rank = {
  rank: number;
  name: string;
  returnPct: number;
  equity: number;
  isYou: boolean;
};

export type Standings = { top: Rank[]; you: Rank | null; totalTraders: number };

/** Top `limit` traders by return, plus the caller's own row if off the board. */
export function getLeaderboard(userId: string, limit = 20): Standings {
  const rows = db.select({
    id: schema.accounts.userId,
    equity: schema.accounts.equity,
    name: schema.users.name,
  })
    .from(schema.accounts)
    .innerJoin(schema.users, eq(schema.accounts.userId, schema.users.id))
    .orderBy(desc(schema.accounts.equity))
    .all();

  const ranked: Rank[] = rows.map((r, i) => ({
    rank: i + 1,
    name: (r.name || "Trader").split(" ")[0],
    returnPct: (r.equity - STARTING_CASH) / STARTING_CASH,
    equity: r.equity,
    isYou: r.id === userId,
  }));

  const top = ranked.slice(0, limit);
  const you = ranked.find((r) => r.isYou) ?? null;
  // Only surface "your" separate row when you're off the visible board.
  const youOffBoard = you && !top.some((r) => r.isYou) ? you : null;

  return { top, you: youOffBoard, totalTraders: ranked.length };
}
