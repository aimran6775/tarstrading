import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/server/db";
import { and, asc, desc, eq, sql as dsql } from "drizzle-orm";
import { reconcile } from "@/server/exchange";
import { getQuotes, isUSMarketOpen } from "@/server/market";
import { liveFeedStatus } from "@/server/live-feed";
import { brainStatus } from "@/server/llm";
import { getAcademyProgress } from "@/server/academy-progress";
import { MISSIONS } from "@/lib/academy/missions";
import { SCENARIOS } from "@/lib/academy/scenarios";
import AppNav from "@/components/app-nav";
import Floor from "./floor";

/*
  The Trading Floor — home base. Everything the trader is, on one screen, the
  moment they log in: their book, their edge, their learning, their agents, the
  market's pulse. One server round trip marks fresh equity and gathers it all.
*/
export const metadata = { title: "Trading Floor" };
export const dynamic = "force-dynamic";

const DEFAULT_MOVERS = ["AAPL", "NVDA", "TSLA", "SPY", "BTC/USD", "ETH/USD"];

type Counts = {
  missions: number; replays: number; streak: number; open_orders: number;
  agents_running: number; agents_alloc: number; trades: number; wins: number; realized_pnl: number;
};

export default async function FloorPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  await reconcile(user.id).catch(() => { /* stale marks are still worth showing */ });

  // Everything below is independent — one parallel fan-out instead of ~8 serial
  // round trips before first paint.
  const [accountRows, cRows, positions, academyProg, equityRows, journal, watch, runningRows] = await Promise.all([
    db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id)),
    db.execute<Counts>(dsql`
      select
        (select count(*)::int from mission_progress where user_id = ${user.id})                                as missions,
        (select count(*)::int from replay_results where user_id = ${user.id})                                  as replays,
        (select coalesce((select current from practice_streaks where user_id = ${user.id}), 0))::int          as streak,
        (select count(*)::int from orders where user_id = ${user.id} and status = 'accepted')                 as open_orders,
        (select count(*)::int from agents where user_id = ${user.id} and status = 'running')                  as agents_running,
        (select coalesce(sum(allocation),0) from agents where user_id = ${user.id} and status = 'running')    as agents_alloc,
        (select count(*)::int from journal_entries where user_id = ${user.id} and pnl is not null)            as trades,
        (select count(*)::int from journal_entries where user_id = ${user.id} and pnl > 0)                    as wins,
        (select coalesce(sum(pnl),0) from journal_entries where user_id = ${user.id})                         as realized_pnl
    `),
    db.select().from(schema.positions).where(eq(schema.positions.userId, user.id)),
    getAcademyProgress(user.id),
    db.select({ equity: schema.equityHistory.equity })
      .from(schema.equityHistory).where(eq(schema.equityHistory.userId, user.id))
      .orderBy(asc(schema.equityHistory.time)).limit(240),
    db.select().from(schema.journalEntries)
      .where(eq(schema.journalEntries.userId, user.id)).orderBy(desc(schema.journalEntries.createdAt)).limit(6),
    db.select({ symbol: schema.watchlistItems.symbol })
      .from(schema.watchlistItems).where(eq(schema.watchlistItems.userId, user.id))
      .orderBy(asc(schema.watchlistItems.rank)).limit(6),
    db.select({ name: schema.agents.name, emoji: schema.agents.emoji })
      .from(schema.agents).where(and(eq(schema.agents.userId, user.id), eq(schema.agents.status, "running"))).limit(1),
  ]);
  const [account] = accountRows;
  const [c] = cRows;
  const [running] = runningRows;

  // Mark positions + gather movers in one quote fetch.
  const moverSymbols = watch.length ? watch.map((w) => w.symbol) : DEFAULT_MOVERS;
  const symbols = [...new Set([...positions.map((p) => p.symbol), ...moverSymbols])];
  const quotes = symbols.length ? await getQuotes(symbols).catch(() => []) : [];
  const q = new Map(quotes.map((x) => [x.symbol, x]));

  const marked = positions.map((p) => {
    const price = q.get(p.symbol)?.price ?? p.avgEntryPrice;
    return { symbol: p.symbol, qty: p.qty, value: price * p.qty, openPnl: (price - p.avgEntryPrice) * p.qty };
  }).sort((a, b) => b.value - a.value);
  const movers = moverSymbols.map((s) => q.get(s)).filter(Boolean)
    .map((x) => ({ symbol: x!.symbol, price: x!.price, changePercent: x!.changePercent }));

  // Max drawdown from the equity curve (peak-to-trough).
  let peak = -Infinity, maxDD = 0;
  for (const e of equityRows) { peak = Math.max(peak, e.equity); if (peak > 0) maxDD = Math.max(maxDD, (peak - e.equity) / peak); }

  const equity = account?.equity ?? 100_000;
  const dayStart = account?.dayStartEquity ?? equity;

  const data = {
    name: user.name,
    equity,
    cash: account?.cash ?? 0,
    dayStart,
    curve: equityRows.map((e) => e.equity),
    positions: marked,
    openPnl: marked.reduce((s, p) => s + p.openPnl, 0),
    invested: marked.reduce((s, p) => s + p.value, 0),
    openOrders: c.open_orders,
    agentsRunning: c.agents_running,
    agentsAlloc: c.agents_alloc,
    agentName: running ? `${running.emoji} ${running.name}` : null,
    movers,
    journal: journal.map((j) => ({ symbol: j.symbol, pnl: j.pnl, createdAt: j.createdAt })),
    academy: {
      xp: academyProg.xp, lessonsDone: academyProg.lessonsDone, totalLessons: academyProg.totalLessons,
      stagesCleared: academyProg.stagesCleared, totalStages: academyProg.totalStages,
      streak: c.streak, missions: c.missions, totalMissions: MISSIONS.length,
      replays: c.replays, totalReplays: SCENARIOS.length,
      nextId: academyProg.next?.id ?? null, nextTitle: academyProg.next?.title ?? null,
    },
    edge: { trades: c.trades, wins: c.wins, realizedPnl: c.realized_pnl, maxDD },
    system: {
      marketOpen: isUSMarketOpen(),
      feed: (() => { const f = liveFeedStatus(); return f.enabled ? (f.stocks.authed || f.crypto.authed ? "live" : "connecting") : "off"; })(),
      brain: brainStatus().provider,
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="floor" />
      <Floor data={data} />
    </div>
  );
}
