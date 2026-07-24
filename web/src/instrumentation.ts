/*
  Server-boot hook (Next instrumentation). On the BACKEND service this starts
  the in-process scheduler: the platform heartbeat every 5 minutes, first run
  shortly after boot. That makes Railway fully self-sufficient — agents trade
  24/7, the vault heals, sessions sweep, and the ticker directory stays fresh
  with NO external cron and no browser required.

  Guards:
  - APP_ROLE === "backend" only — the frontend service and local dev never
    double-tick (dev keeps the on-demand /api/cron/tick + in-app tickers).
  - nodejs runtime only (instrumentation also evaluates for edge).
  - globalThis flag — dev HMR or duplicate registers never stack intervals.
*/

const EVERY_MS = 5 * 60_000;
const FIRST_MS = 15_000;

declare global {
  var __tarsHeartbeat: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.APP_ROLE !== "backend") return;
  if (globalThis.__tarsHeartbeat) return;
  globalThis.__tarsHeartbeat = true;

  const { runHeartbeat } = await import("./server/heartbeat");
  const beat = () => runHeartbeat("auto").catch(() => { /* logged in cron_runs; next beat retries */ });

  setTimeout(beat, FIRST_MS);
  setInterval(beat, EVERY_MS);
  console.log(`[tars] backend heartbeat armed — every ${EVERY_MS / 60_000}m`);
}
