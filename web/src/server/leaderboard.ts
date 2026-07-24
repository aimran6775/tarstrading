import "server-only";
import { db, schema } from "./db";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { STARTING_CASH } from "./auth";

/*
  Leaderboard — everyone started with the same $100k, so the only fair ranking
  is return on that stake. We rank on the cached mark-to-market equity (kept
  fresh by markEquity on every poll), so this is a fast read with no quotes
  fetched here. First names only; no emails leave the server.

  Scales with total users: we fetch only the top N rows (indexed ORDER BY on
  accounts.equity) plus two scalar counts — never the whole table.
*/

export type Rank = {
  rank: number;
  name: string;
  returnPct: number;
  equity: number;
  isYou: boolean;
};

export type Standings = { top: Rank[]; you: Rank | null; totalTraders: number };

const firstName = (n: string | null) => (n || "Trader").split(" ")[0];
const toRank = (equity: number, rank: number, name: string | null, isYou: boolean): Rank => ({
  rank, name: firstName(name), returnPct: (equity - STARTING_CASH) / STARTING_CASH, equity, isYou,
});

/** Top `limit` traders by return, plus the caller's own row if off the board. */
export async function getLeaderboard(userId: string, limit = 20): Promise<Standings> {
  const rows = await db.select({
    id: schema.accounts.userId,
    equity: schema.accounts.equity,
    name: schema.users.name,
  })
    .from(schema.accounts)
    .innerJoin(schema.users, eq(schema.accounts.userId, schema.users.id))
    .orderBy(desc(schema.accounts.equity))
    .limit(limit);

  const [{ total }] = await db.execute<{ total: number }>(dsql`select count(*)::int as total from accounts`);
  const top = rows.map((r, i) => toRank(r.equity, i + 1, r.name, r.id === userId));

  // If the caller isn't on the visible board, compute just their rank (a single
  // indexed count of accounts richer than them) — no full scan.
  let you: Rank | null = null;
  if (!top.some((r) => r.isYou)) {
    const [me] = await db.select({ equity: schema.accounts.equity, name: schema.users.name })
      .from(schema.accounts)
      .innerJoin(schema.users, eq(schema.accounts.userId, schema.users.id))
      .where(eq(schema.accounts.userId, userId));
    if (me) {
      const [{ ahead }] = await db.execute<{ ahead: number }>(
        dsql`select count(*)::int as ahead from accounts where equity > ${me.equity}`);
      you = toRank(me.equity, ahead + 1, me.name, true);
    }
  }

  return { top, you, totalTraders: total };
}
