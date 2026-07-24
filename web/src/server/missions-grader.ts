import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { markEquity } from "@/server/exchange";
import { MISSIONS, type MissionKey, type MissionResult } from "@/lib/academy/missions";

/*
  The mission grader — reads the learner's real (simulated) account and checks
  the PROCESS the academy teaches, never the outcome. A long position is
  protected by an accepted SELL · STOP that covers its full quantity; the risk
  it defines is (entry − stop) × shares, floored at zero (a stop above entry is
  a free roll). Heat is the sum of that across every open position.
*/

// Whole-share rounding on stocks means you often can't hit exactly 1% — a little
// slack keeps the lesson honest without rewarding sloppiness.
const RISK_CAP = 0.0125; // ≤ ~1% of equity, per position
const HEAT_CAP = 0.06;   // ≤ 6% of equity, total open risk
const EPS = 1e-9;

type Position = typeof schema.positions.$inferSelect;
type Order = typeof schema.orders.$inferSelect;
type State = { equity: number; positions: Position[]; stops: Order[]; closed: number };

const money = (n: number) => "$" + Math.round(n).toLocaleString();
const pct = (f: number) => (f * 100).toFixed(2) + "%";

async function loadState(userId: string, fresh: boolean): Promise<State> {
  if (fresh) await markEquity(userId).catch(() => { /* stale equity is fine to grade on */ });
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const positions = await db.select().from(schema.positions).where(eq(schema.positions.userId, userId));
  const accepted = await db.select().from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), eq(schema.orders.status, "accepted")));
  const stops = accepted.filter((o) => o.type === "stop" && o.side === "sell" && o.stopPrice != null);
  const closed = await db.select({ id: schema.journalEntries.id })
    .from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId));
  return { equity: account?.equity ?? 0, positions, stops, closed: closed.length };
}

/** The accepted sell-stop that fully covers this long position, tightest first. */
function coveringStop(pos: Position, stops: Order[]): Order | null {
  return stops
    .filter((s) => s.symbol === pos.symbol && s.qty >= pos.qty - EPS)
    .sort((a, b) => (b.stopPrice ?? 0) - (a.stopPrice ?? 0))[0] ?? null;
}

/** Risk this position defines to its protecting stop, in dollars. Null = no stop. */
function positionRisk(pos: Position, stops: Order[]): number | null {
  const stop = coveringStop(pos, stops);
  if (!stop || stop.stopPrice == null) return null;
  return Math.max(0, pos.avgEntryPrice - stop.stopPrice) * pos.qty;
}

function grade(key: MissionKey, s: State): MissionResult {
  const eq = s.equity > 0 ? s.equity : 1;

  if (key === "round-trip") {
    const ok = s.closed > 0;
    return {
      passed: ok,
      checks: [{ label: "Open and close a position", ok, detail: ok ? `${s.closed} round trip${s.closed === 1 ? "" : "s"} logged` : "Buy any symbol on the desk, then sell it back." }],
    };
  }

  if (key === "sized-stop") {
    const stopped = s.positions.map((p) => ({ p, risk: positionRisk(p, s.stops) })).filter((x) => x.risk != null) as { p: Position; risk: number }[];
    const qualifying = stopped.filter((x) => x.risk / eq <= RISK_CAP);
    const best = qualifying.sort((a, b) => a.risk - b.risk)[0] ?? stopped.sort((a, b) => a.risk - b.risk)[0];
    return {
      passed: qualifying.length > 0,
      checks: [
        { label: "Hold a position", ok: s.positions.length > 0, detail: s.positions.length ? `${s.positions.length} open` : "Buy a symbol on the desk to start." },
        { label: "Protect it with a stop", ok: stopped.length > 0, detail: stopped.length ? `${best.p.symbol} protected` : "Place a SELL · STOP below your entry." },
        { label: "Risk 1% of the account or less", ok: qualifying.length > 0, detail: best ? `${best.p.symbol}: ${money(best.risk)} (${pct(best.risk / eq)}) at risk` : "Set a stop first." },
      ],
    };
  }

  // heat
  const risks = s.positions.map((p) => positionRisk(p, s.stops));
  const unprotected = s.positions.filter((_, i) => risks[i] == null);
  const allStopped = s.positions.length > 0 && unprotected.length === 0;
  const totalRisk: number = allStopped ? risks.reduce((sum: number, r) => sum + (r ?? 0), 0) : Infinity;
  return {
    passed: s.positions.length >= 2 && allStopped && totalRisk / eq <= HEAT_CAP,
    checks: [
      { label: "Hold two or more positions", ok: s.positions.length >= 2, detail: `${s.positions.length} open` },
      { label: "Every position has a stop", ok: allStopped, detail: unprotected.length ? `${unprotected.map((p) => p.symbol).join(", ")} unprotected` : (s.positions.length ? "all protected" : "no positions yet") },
      { label: "Total open risk under 6%", ok: allStopped && totalRisk / eq <= HEAT_CAP, detail: allStopped ? `${pct(totalRisk / eq)} total heat` : "add stops to measure heat" },
    ],
  };
}

export type GradedMission = MissionResult & { missionId: string; complete: boolean; justCompleted?: boolean };

/** Grade every mission and fold in which are already banked. Read-only. */
export async function gradeAllMissions(userId: string, fresh = false): Promise<GradedMission[]> {
  const state = await loadState(userId, fresh);
  const done = new Set((await db.select({ missionId: schema.missionProgress.missionId })
    .from(schema.missionProgress).where(eq(schema.missionProgress.userId, userId))).map((r) => r.missionId));
  return MISSIONS.map((m) => {
    const res = grade(m.key, state);
    return { missionId: m.id, complete: done.has(m.id), ...res };
  });
}

/** Grade ONE mission against fresh state and bank it if it newly passes. */
export async function checkMission(userId: string, missionId: string): Promise<GradedMission | null> {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return null;

  const state = await loadState(userId, true);
  const res = grade(mission.key, state);

  const [existing] = await db.select({ id: schema.missionProgress.id })
    .from(schema.missionProgress)
    .where(and(eq(schema.missionProgress.userId, userId), eq(schema.missionProgress.missionId, missionId)));

  let justCompleted = false;
  if (res.passed && !existing) {
    await db.insert(schema.missionProgress).values({
      id: randomUUID(), userId, missionId, completedAt: Date.now(), xp: mission.xp,
    }).onConflictDoNothing();
    justCompleted = true;
  }
  return { missionId, complete: res.passed || !!existing, justCompleted, ...res };
}
