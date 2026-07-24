import { db, schema } from "@/server/db";
import { desc } from "drizzle-orm";
import { dataCensus } from "@/server/admin-ops";
import { PageHeader, SectionHeader, DataTable } from "../ui";
import BackfillButton from "./backfill-button";

/*
  Data ops — the vault's coverage map and the upstream call ledger, plus a
  census of every table we hold. The "watch the website getting its data"
  page: what history each series holds, how fresh its tail is, every call
  spent getting it, and nothing dark in the schema.
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
      <PageHeader title="Data ops" right={<BackfillButton />} />

      {/* Data census — every table we hold, nothing dark */}
      <SectionHeader right={<span className="font-mono text-[11px] text-ink-4">{census.tableCount} tables · {census.total.toLocaleString()} rows</span>}>Data census</SectionHeader>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <SectionHeader>Vault coverage</SectionHeader>
      <DataTable
        empty="Vault is empty — open a chart or run a backfill and it fills itself."
        cols={[{ label: "Series" }, { label: "Bars", align: "right" }, { label: "Coverage" }, { label: "Last sync" }, { label: "Status" }]}
        rows={series.map((s) => [
          <span key="s">{s.symbol} <span className="text-ink-4">{s.timeframe}</span></span>,
          s.barCount,
          <span key="c" className="text-ink-3">{d(s.earliest)} → {d(s.latest)}</span>,
          <span key="t" className="text-ink-3">{t(s.lastSyncAt)}</span>,
          <span key="st" className={`font-mono text-[10px] uppercase tracking-[0.15em] ${s.status === "ok" ? "text-gain" : s.status === "error" ? "text-loss" : "text-gold"}`}>
            {s.status}{s.lastError && <span className="ml-2 text-loss">{s.lastError}</span>}
          </span>,
        ])}
      />

      {/* Upstream ledger */}
      <SectionHeader right={<span className="font-mono text-[11px] text-ink-4">last 40</span>}>Upstream calls</SectionHeader>
      <DataTable
        empty="No upstream calls logged yet."
        cols={[{ label: "When" }, { label: "Endpoint" }, { label: "Status", align: "right" }, { label: "Latency", align: "right" }]}
        rows={calls.map((c) => [
          <span key="w" className="text-ink-3">{new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>,
          <span key="e" className="block max-w-[380px] truncate">{c.endpoint}</span>,
          <span key="s" className={c.status >= 400 || c.status < 0 ? "text-loss" : "text-gain"}>{c.status}</span>,
          <span key="l" className="text-ink-3">{c.ms}ms</span>,
        ])}
      />
    </>
  );
}
