import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";
import { getPlatformConfig } from "@/server/platform";
import { PageHeader, SectionHeader, DataTable } from "../ui";
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
      <PageHeader title="Controls" right={<span className="font-mono text-[11px] text-ink-4">kill switches · logbook</span>} />
      <ControlPanel initial={config} />

      <SectionHeader>Cron heartbeats</SectionHeader>
      <DataTable
        empty="No heartbeats yet — hit /api/cron/tick with the CRON_SECRET or schedule it."
        cols={[{ label: "When" }, { label: "Result" }, { label: "Agents ticked" }, { label: "Took", align: "right" }, { label: "Backfill" }]}
        rows={runs.map((r) => [
          <span key="w" className="text-ink-3">{when(r.createdAt)}</span>,
          <span key="ok" className={`font-mono text-[10px] uppercase ${r.ok ? "text-gain" : "text-loss"}`}>{r.ok ? "ok" : "fail"}</span>,
          `${r.users} users · ${r.actions} actions`,
          <span key="ms" className="text-ink-3">{r.ms}ms</span>,
          <span key="d" className="block max-w-[320px] truncate text-ink-4">{r.detail ?? "—"}</span>,
        ])}
      />

      <SectionHeader>Rate-limit buckets</SectionHeader>
      <DataTable
        empty="No buckets right now."
        cols={[{ label: "Key" }, { label: "Count", align: "right" }, { label: "Resets", align: "right" }]}
        rows={limits.map((l) => [l.key, l.count, <span key="r" className="text-ink-3">{when(l.resetAt)}</span>])}
      />

      <SectionHeader>Admin audit</SectionHeader>
      <DataTable
        empty="Nothing yet — actions taken here log themselves."
        cols={[{ label: "When" }, { label: "Who" }, { label: "Action" }, { label: "Detail" }]}
        rows={audit.map((a) => [
          <span key="w" className="text-ink-3">{when(a.createdAt)}</span>,
          a.email,
          <span key="a" className="font-mono text-[10px] uppercase text-agent">{a.action}</span>,
          <span key="d" className="block max-w-[320px] truncate text-ink-4">{a.detail ?? "—"}</span>,
        ])}
      />
    </>
  );
}
