import { db, schema } from "@/server/db";
import { sql as dsql } from "drizzle-orm";
import { liveFeedStatus } from "@/server/live-feed";
import { PageHeader, SectionHeader, DataTable, StatCard, Badge } from "../ui";
import RunFeedsButton from "./run-button";

/*
  Feeds — the health board for the free-data mesh. One row per source (the
  delayed-SIP sweep, the live slots, FX daily, index calibration, futures),
  the quote cache's provenance mix, and the websocket lanes. This page is how
  an operator answers "is the platform's data alive right now?" in one look.
*/
export const metadata = { title: "Feeds" };
export const dynamic = "force-dynamic";

const ago = (ms: number | null) => {
  if (!ms) return "never";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

/** What each source row means, for the operator who didn't write it. */
const SOURCE_NOTES: Record<string, string> = {
  sweep: "Whole-board quotes, 15-min SIP (60s beat)",
  "sweep-stocks": "Last sweep that included equities",
  "live-slots": "The 30 real-time IEX slots (featured symbols)",
  fx: "ECB daily reference rates → 16 pairs",
  "indices-daily": "Official index closes + ETF-ratio calibration",
  futures: "Front-month session bars (CME/CBOT/NYMEX/COMEX)",
};

export default async function Feeds() {
  const [sources, mixRows, cacheAgg] = await Promise.all([
    db.select().from(schema.feedStatus).orderBy(schema.feedStatus.source),
    db.execute<{ source: string; n: number; fresh2m: number; fresh1h: number }>(dsql`
      select source, count(*)::int as n,
             count(*) filter (where updated_at > ${Date.now() - 2 * 60_000})::int  as fresh2m,
             count(*) filter (where updated_at > ${Date.now() - 3_600_000})::int as fresh1h
        from quote_cache group by source order by n desc
    `),
    db.execute<{ total: number; fresh2m: number }>(dsql`
      select count(*)::int as total,
             count(*) filter (where updated_at > ${Date.now() - 2 * 60_000})::int as fresh2m
        from quote_cache
    `),
  ]);
  const mix = Array.from(mixRows);
  const agg = Array.from(cacheAgg)[0] ?? { total: 0, fresh2m: 0 };
  const live = liveFeedStatus();

  return (
    <>
      <PageHeader title="Feeds" sub="The free-data mesh — every market, honestly labelled"
        right={<RunFeedsButton />} />

      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Symbols priced" value={agg.total.toLocaleString()}
          sub={`${agg.fresh2m.toLocaleString()} fresh under 2m`} />
        {/* The websocket streams live on the WEB tier by policy (one Alpaca
            connection per stream); this console runs on the backend, so
            "not connected here" is the healthy state, not an outage. */}
        <StatCard label="Live slots" value={live.stocks.slots ? `${live.stocks.slots.used}/${live.stocks.slots.max}` : "—"}
          sub={live.stocks.connected ? "IEX stream connected" : "streams held on the web tier"} />
        <StatCard label="Crypto streams" value={String(live.crypto.subscribed)}
          sub={live.crypto.connected ? "real-time, 24/7" : "streams held on the web tier"} />
        <StatCard label="Ticks seen" value={live.ticksSeen.toLocaleString()}
          sub={`${live.symbolsTicking} symbols ticking`} />
      </div>

      <SectionHeader>Sources</SectionHeader>
      <DataTable
        empty="No feed has reported yet — the scheduler runs within a minute of boot, or run a pass now."
        cols={[{ label: "Source" }, { label: "What it does" }, { label: "Last run" }, { label: "Covered", align: "right" }, { label: "Status" }]}
        rows={sources.map((s) => [
          <span key="s" className="font-mono text-[12px] text-ink-1">{s.source}</span>,
          <span key="w" className="text-ink-3">{SOURCE_NOTES[s.source] ?? "—"}</span>,
          <span key="t" className="text-ink-3">{ago(s.lastRunAt)}</span>,
          s.covered,
          <Badge key="b" tone={s.ok ? "default" : "warn"} dot>{s.ok ? "ok" : "erroring"}</Badge>,
        ])}
      />

      <SectionHeader>Provenance mix</SectionHeader>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
        Where every cached price comes from. The product shows the same labels —
        LIVE, DELAYED&nbsp;15M, EOD, DERIVED — so this table is exactly what users see.
      </p>
      <DataTable
        empty="Quote cache is empty — run a feeds pass."
        cols={[{ label: "Provenance" }, { label: "Symbols", align: "right" }, { label: "Fresh <2m", align: "right" }, { label: "Fresh <1h", align: "right" }]}
        rows={mix.map((m) => [
          <span key="p" className="font-mono text-[12px] uppercase tracking-wider text-ink-1">{m.source}</span>,
          m.n, m.fresh2m, m.fresh1h,
        ])}
      />
    </>
  );
}
