import "server-only";
import { db, schema } from "./db";

/*
  Platform-wide runtime state the admin control-center flips and the app obeys:
  a trading kill switch, an agents pause, and a broadcast banner. Read on hot
  paths (order placement), so it's cached in-process for a few seconds — a
  flipped switch propagates within the TTL, which is plenty for an ops control.
*/

export type PlatformConfig = { tradingHalted: boolean; agentsPaused: boolean; announcement: string };

export const CFG = { HALT: "trading_halted", PAUSE: "agents_paused", ANNOUNCE: "announcement" } as const;

const TTL_MS = 8_000;
let cached: { at: number; cfg: PlatformConfig } | null = null;

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cfg;
  let cfg: PlatformConfig = { tradingHalted: false, agentsPaused: false, announcement: "" };
  try {
    const rows = await db.select().from(schema.platformConfig);
    const m = new Map(rows.map((r) => [r.key, r.value]));
    cfg = {
      tradingHalted: m.get(CFG.HALT) === "1",
      agentsPaused: m.get(CFG.PAUSE) === "1",
      announcement: m.get(CFG.ANNOUNCE) ?? "",
    };
  } catch { /* DB blip → treat as all-clear; never block the whole app on config */ }
  cached = { at: Date.now(), cfg };
  return cfg;
}

export async function setPlatformConfig(key: string, value: string, adminId: string): Promise<void> {
  const now = Date.now();
  await db.insert(schema.platformConfig)
    .values({ key, value, updatedBy: adminId, updatedAt: now })
    .onConflictDoUpdate({ target: schema.platformConfig.key, set: { value, updatedBy: adminId, updatedAt: now } });
  cached = null; // invalidate on this instance immediately
}
