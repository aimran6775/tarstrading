/*
  Server-boot hook (Next instrumentation). On the BACKEND service this arms
  the in-process scheduler: every 5 minutes it calls its OWN /api/cron/tick
  over loopback (CRON_SECRET-authed), which runs the platform heartbeat —
  agents trade 24/7, the vault heals, sessions sweep, the ticker directory
  stays fresh. No external cron, no browser required.

  Deliberately import-free: instrumentation is compiled for edge and client
  fallback bundles too, where node builtins (crypto/net/tls via the server
  graph) don't resolve. A loopback fetch keeps the module graph empty and the
  scheduler bulletproof across every compile target.

  Guards: backend role only, nodejs runtime only, globalThis flag so HMR or
  duplicate registers never stack intervals.
*/

const EVERY_MS = 5 * 60_000;
const FIRST_MS = 15_000;
// The feeds sweep keeps the whole board's quote cache ≤60s old — that cadence
// is what makes Markets feel alive on the free data tiers.
const FEEDS_EVERY_MS = 60_000;
const FEEDS_FIRST_MS = 30_000;

declare global {
  var __tarsHeartbeat: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.APP_ROLE !== "backend") return;
  if (!process.env.CRON_SECRET) return; // fail closed, same as the route
  if (globalThis.__tarsHeartbeat) return;
  globalThis.__tarsHeartbeat = true;

  const port = process.env.PORT ?? "3000";
  /*
    Overrun guard + timeout (gaps 44, 46).

    The loopback fetch had no timeout, so a hung route leaked a socket every
    beat forever; and nothing stopped a slow beat from overlapping the next
    one, which is exactly how the sweeps piled onto the same account locks
    and wedged the pool. Each beat now skips if its predecessor is still
    running, and aborts at a deadline shorter than its own interval.
  */
  const running = new Set<string>();
  const hit = (path: string, timeoutMs: number) => () => {
    if (running.has(path)) {
      console.warn(`[tars] skipping ${path} — previous beat still running`);
      return;
    }
    running.add(path);
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(), timeoutMs);
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: ctl.signal,
    })
      .catch(() => { /* logged when it lands; next beat retries */ })
      .finally(() => { clearTimeout(kill); running.delete(path); });
  };
  const beat = hit("/api/cron/tick", EVERY_MS - 15_000);
  const feeds = hit("/api/cron/feeds", FEEDS_EVERY_MS - 5_000);

  setTimeout(beat, FIRST_MS);
  setInterval(beat, EVERY_MS);
  setTimeout(feeds, FEEDS_FIRST_MS);
  setInterval(feeds, FEEDS_EVERY_MS);
  console.log(`[tars] backend heartbeat armed — tick every ${EVERY_MS / 60_000}m, feeds every ${FEEDS_EVERY_MS / 1000}s`);
}
