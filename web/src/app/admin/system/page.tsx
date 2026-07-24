import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";
import { getPlatformConfig } from "@/server/platform";
import ControlPanel from "./control-panel";

/*
  Controls & system — the operational control center: platform kill switches, a
  broadcast banner, and one-shot ops up top; the machine's own logbook (cron
  heartbeats, rate-limit buckets, and the admin audit trail) below.
*/
export const metadata = { title: "Controls" };
export const dynamic = "force-dynamic";

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminSystem() {
  const [config, runs, limits, audit] = await Promise.all([
    getPlatformConfig(),
    db.select().from(schema.cronRuns).orderBy(desc(schema.cronRuns.createdAt)).limit(20),
    db.select().from(schema.rateLimits).limit(50),
    db.select({
      id: schema.adminAudit.id, action: schema.adminAudit.action,
      detail: schema.adminAudit.detail, createdAt: schema.adminAudit.createdAt,
      email: schema.users.email,
    }).from(schema.adminAudit)
      .innerJoin(schema.users, eq(schema.adminAudit.userId, schema.users.id))
      .orderBy(desc(schema.adminAudit.createdAt)).limit(40),
  ]);

  return (
    <>
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Controls</h1>
      <ControlPanel initial={config} />

      <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Cron heartbeats</h2>
      <section className="panel mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">OK</th>
              <th className="px-4 py-2.5">Agents ticked</th>
              <th className="px-4 py-2.5">Took</th>
              <th className="px-4 py-2.5">Backfill</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                No heartbeats yet — hit /api/cron/tick with the CRON_SECRET or schedule it.
              </td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="tnum px-4 py-2 text-ink-3">{when(r.createdAt)}</td>
                <td className={`px-4 py-2 font-mono text-[10px] uppercase ${r.ok ? "text-gain" : "text-loss"}`}>
                  {r.ok ? "ok" : "fail"}
                </td>
                <td className="tnum px-4 py-2 text-ink-2">{r.users} users · {r.actions} actions</td>
                <td className="tnum px-4 py-2 text-ink-3">{r.ms}ms</td>
                <td className="tnum max-w-[320px] truncate px-4 py-2 text-ink-4">{r.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Rate-limit buckets</h2>
      <section className="panel mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">Key</th>
              <th className="px-4 py-2.5">Count</th>
              <th className="px-4 py-2.5">Resets</th>
            </tr>
          </thead>
          <tbody>
            {limits.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-4">No buckets right now.</td></tr>
            )}
            {limits.map((l) => (
              <tr key={l.key} className="border-b border-hairline last:border-0">
                <td className="tnum px-4 py-2 text-ink-2">{l.key}</td>
                <td className="tnum px-4 py-2 text-ink-1">{l.count}</td>
                <td className="tnum px-4 py-2 text-ink-3">{when(l.resetAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Admin audit</h2>
      <section className="panel mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Who</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-4">Nothing yet — actions taken here log themselves.</td></tr>
            )}
            {audit.map((a) => (
              <tr key={a.id} className="border-b border-hairline last:border-0">
                <td className="tnum px-4 py-2 text-ink-3">{when(a.createdAt)}</td>
                <td className="px-4 py-2 text-ink-2">{a.email}</td>
                <td className="px-4 py-2 font-mono text-[10px] uppercase text-agent">{a.action}</td>
                <td className="tnum max-w-[320px] truncate px-4 py-2 text-ink-4">{a.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
