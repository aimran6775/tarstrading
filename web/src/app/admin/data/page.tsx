import { db, schema } from "@/server/db";
import { desc } from "drizzle-orm";
import { dataCensus } from "@/server/admin-ops";
import BackfillButton from "./backfill-button";

/*
  Data ops — the vault's coverage map and the upstream call ledger. This is
  the "watch the website getting its data" page: what history each series
  holds, how fresh its tail is, and every call spent getting it.
*/
export const metadata = { title: "Data ops" };
export const dynamic = "force-dynamic";

const d = (s: number | null) => s ? new Date(s * 1000).toISOString().slice(0, 10) : "—";
const t = (ms: number | null) => ms ? new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

export default async function DataOps() {
  const [series, calls, census] = await Promise.all([
    db.select().from(schema.syncState).orderBy(schema.syncState.symbol, schema.syncState.timeframe),
    db.select().from(schema.apiCalls).orderBy(desc(schema.apiCalls.createdAt)).limit(40),
    dataCensus(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Data ops</h1>
        <BackfillButton />
      </div>

      {/* Data census — every table we hold, nothing dark */}
      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Data census</h2>
        <span className="font-mono text-[11px] text-ink-4">
          {census.tableCount} tables · {census.total.toLocaleString()} rows
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {census.groups.map((g) => (
          <section key={g.group} className="panel p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-ink-1">{g.group}</h3>
              <span className="tnum font-mono text-[11px] text-ink-4">{g.total.toLocaleString()}</span>
            </div>
            <dl className="mt-2 space-y-1">
              {g.tables.map((t) => (
                <div key={t.table} className="flex items-baseline justify-between gap-2">
                  <dt className="font-mono text-[11px] text-ink-3">{t.table}</dt>
                  <dd className={`tnum font-mono text-[11px] ${t.rows === 0 ? "text-ink-4" : "text-ink-1"}`}>{t.rows.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/* Coverage map */}
      <section className="panel mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">Series</th>
              <th className="px-4 py-2.5">Bars</th>
              <th className="px-4 py-2.5">Coverage</th>
              <th className="px-4 py-2.5">Last sync</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {series.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                Vault is empty — open a chart or run a backfill and it fills itself.
              </td></tr>
            )}
            {series.map((s) => (
              <tr key={s.id} className="border-b border-hairline last:border-0">
                <td className="tnum px-4 py-2 font-medium text-ink-1">{s.symbol} <span className="text-ink-4">{s.timeframe}</span></td>
                <td className="tnum px-4 py-2 text-ink-2">{s.barCount}</td>
                <td className="tnum px-4 py-2 text-ink-3">{d(s.earliest)} → {d(s.latest)}</td>
                <td className="tnum px-4 py-2 text-ink-3">{t(s.lastSyncAt)}</td>
                <td className="px-4 py-2">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                    s.status === "ok" ? "text-gain" : s.status === "error" ? "text-loss" : "text-gold"
                  }`}>{s.status}</span>
                  {s.lastError && <span className="ml-2 text-[10px] text-loss">{s.lastError}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Upstream ledger */}
      <h2 className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Upstream calls · last 40</h2>
      <section className="panel mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Endpoint</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Latency</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-4">No upstream calls logged yet.</td></tr>
            )}
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-hairline last:border-0">
                <td className="tnum px-4 py-2 text-ink-3">
                  {new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
                <td className="tnum max-w-[380px] truncate px-4 py-2 text-ink-2">{c.endpoint}</td>
                <td className={`tnum px-4 py-2 ${c.status >= 400 || c.status < 0 ? "text-loss" : "text-gain"}`}>{c.status}</td>
                <td className="tnum px-4 py-2 text-ink-3">{c.ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
