import Link from "next/link";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/server/db";
import { brainStatus } from "@/server/llm";
import { liveFeedStatus } from "@/server/live-feed";
import { getPlatformConfig } from "@/server/platform";
import { getOverview, computeHealth } from "@/server/admin-metrics";
import {
  PageHeader, SectionHeader, StatCard, StatusChip, Sparkline,
  HeroMetric, Field, Badge, MetricRow, EmptyState,
} from "./ui";

/*
  Overview — the command deck. It answers three questions in reading order:
  is the platform healthy, how much simulated capital is riding on it, and what
  has moved in the last day. Everything below the verdict is grouped into
  Platform health · Activity · Data, so an operator can scan one band at a time.

  Every read is straight from Postgres — a handful of parallel queries on one
  pooled connection, nothing cached, so the deck always tells the truth about
  right now.
*/
export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const fmtUsd = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};
/** The monumental figure is read out loud — give it every digit. */
const heroUsd = (n: number) =>
  n >= 100_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}`;
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const since = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86_400)}d`;
};
const ago = (at: number, now: number) => `${since(now - at)} ago`;

const BAND: Record<"nominal" | "degraded" | "critical", { ring: string; dot: string; text: string; label: string }> = {
  nominal: { ring: "border-gain/40 bg-gain/8", dot: "bg-gain", text: "text-gain", label: "All systems nominal" },
  degraded: { ring: "border-gold/40 bg-gold/8", dot: "bg-gold", text: "text-gold", label: "Degraded" },
  critical: { ring: "border-loss/50 bg-loss/10", dot: "bg-loss", text: "text-loss", label: "Critical" },
};

type Coverage = { series: number; ok: number; broken: number; last_sync: number | null };

export default async function AdminOverview() {
  const now = Date.now();
  const brain = brainStatus();
  const feed = liveFeedStatus();

  const [cfg, { snap, spark, pulse, top, bottom }, [cov]] = await Promise.all([
    getPlatformConfig(),
    getOverview(now),
    // Coverage of the market-data vault: how many series are clean, and how
    // fresh the freshest tail is.
    db.execute<Coverage>(dsql`
      select
        count(*)::int                                                    as series,
        coalesce(sum(case when status = 'ok'    then 1 else 0 end), 0)::int as ok,
        coalesce(sum(case when status = 'error' then 1 else 0 end), 0)::int as broken,
        max(last_sync_at)::float8                                        as last_sync
      from sync_state
    `),
  ]);

  const feedOk: boolean | "connecting" | "off" =
    !feed.enabled ? "off" : (feed.stocks.authed || feed.crypto.authed) ? true : "connecting";
  const health = computeHealth({
    lastCron: snap.last_cron, now, errors1h: snap.errors1h, calls1h: snap.calls1h,
    feedOk, brainOk: brain.provider !== "scripted", halted: cfg.tradingHalted, paused: cfg.agentsPaused,
  });
  const band = BAND[health.status];
  const unhappy = health.signals.filter((s) => s.level !== "ok").length;

  const books = snap.profitable + snap.underwater;
  const cronAge = snap.last_cron ? now - snap.last_cron : null;
  const cronTone = cronAge == null || cronAge > 30 * 60_000 ? "loss"
    : cronAge > 8 * 60_000 ? "warn" : "gain";
  const errTone = snap.errors1h > 20 ? "loss" : snap.errors1h > 0 ? "warn" : "gain";
  const covTone = cov && cov.broken > 0 ? "loss" : cov && cov.ok === cov.series && cov.series > 0 ? "gain" : "default";

  // Top gainers then bottom losers, de-duped (small platforms may overlap).
  const movers = (() => {
    const seen = new Set<string>();
    const out: typeof top = [];
    for (const m of [...top, ...bottom.slice().reverse()]) {
      if (seen.has(m.email)) continue;
      seen.add(m.email); out.push(m);
    }
    return out;
  })();

  return (
    <>
      <PageHeader
        title="Overview"
        right={
          <>
            <Badge tone="accent" dot>Live</Badge>
            <span className="tnum text-[11px] text-ink-4">{new Date(now).toLocaleTimeString()}</span>
          </>
        }
      />

      {/* ---- The deck: capital riding on the platform, and the verdict ---- */}
      <section className="raised rise-in relative mt-5 overflow-hidden p-5 md:p-7">
        <div aria-hidden className="aura aura-agent" />
        <div className="relative grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroMetric
            label="Simulated capital under management"
            value={heroUsd(snap.aum)}
            sub={<>across <span className="text-ink-1">{snap.users}</span> accounts · {books} active {books === 1 ? "book" : "books"}</>}
          >
            <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
              <Field label="Day P&L" value={signed(snap.day_pnl)} sub="since ET open"
                tone={snap.day_pnl > 0 ? "gain" : snap.day_pnl < 0 ? "loss" : "default"} />
              <Field label="In profit" value={snap.profitable}
                sub={books ? `${pct(snap.profitable, books)}% of books` : "no books yet"}
                tone={snap.profitable > 0 ? "gain" : "muted"} />
              <Field label="Underwater" value={snap.underwater} sub="below $100k start"
                tone={snap.underwater > 0 ? "loss" : "muted"} />
              <Field label="Sessions live" value={snap.sessions} sub={`${snap.new_users24} new · 24h`} />
            </div>
          </HeroMetric>

          {/* the verdict — the one thing an operator checks first */}
          <div className="lg:border-l lg:border-hairline lg:pl-7">
            <div className={`rounded-[var(--r-m)] border p-4 ${band.ring}`}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${band.dot} ${health.status !== "nominal" ? "animate-pulse" : ""}`} />
                <h2 className={`font-display text-base font-bold ${band.text}`}>{band.label}</h2>
              </div>
              <p className="mt-1 font-mono text-[11px] text-ink-4">
                {unhappy > 0
                  ? `${unhappy} signal${unhappy === 1 ? "" : "s"} need${unhappy === 1 ? "s" : ""} a look`
                  : "every signal clean"}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {health.signals.map((s) => (
                <StatusChip key={s.label} level={s.level} label={s.label} detail={s.detail} />
              ))}
            </div>
            <Link href="/admin/system"
              className="pressable mt-4 inline-flex min-h-9 items-center gap-1.5 font-mono text-[11px] text-ink-3 transition-colors hover:text-agent">
              Open controls
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Platform health ---- */}
      <SectionHeader right={<Badge tone="muted">machine</Badge>}>Platform health</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Heartbeat" tone={cronTone}
          value={cronAge == null ? "never" : since(cronAge)}
          sub={cronAge == null ? "cron has never run" : "since last cron tick"} />
        <StatCard label="Upstream · 1h" value={snap.calls1h} tone="default"
          delta={snap.errors1h > 0 ? `${snap.errors1h} err` : "clean"} deltaTone={errTone}
          sub={`${pct(snap.calls1h - snap.errors1h, snap.calls1h)}% clean of ${snap.calls1h} calls`} />
        <StatCard label="Analysts live" value={snap.agents_running} tone="accent"
          sub={cfg.agentsPaused ? "PAUSED (manual hold)" : "running right now"}
          right={cfg.agentsPaused ? <Badge tone="warn">paused</Badge> : undefined} />
        <StatCard label="Order flow" value={cfg.tradingHalted ? "Halted" : "Open"}
          tone={cfg.tradingHalted ? "warn" : "gain"}
          sub={cfg.tradingHalted ? "manual kill switch is on" : "accepting orders"} />
      </div>

      {/* ---- Activity ---- */}
      <SectionHeader right={<span className="font-mono text-[11px] text-ink-4">last 24h</span>}>Activity</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders" value={snap.orders24}
          right={<Sparkline data={spark} className="h-7 w-20" />}
          sub="hourly volume, oldest → newest" />
        <StatCard label="Filled" value={snap.fills24}
          tone={snap.fills24 > 0 ? "gain" : "default"}
          delta={snap.orders24 ? `${pct(snap.fills24, snap.orders24)}%` : undefined}
          deltaTone="muted" sub="of the day's tickets" />
        <StatCard label="Rejected" value={snap.rejects24}
          tone={snap.rejects24 > 0 ? "loss" : "default"}
          delta={snap.orders24 ? `${pct(snap.rejects24, snap.orders24)}%` : undefined}
          deltaTone="muted" sub="risk checks + bad tickets" />
        <StatCard label="Assistant" value={snap.chats24} sub="desk + Tars messages" />
      </div>

      {/* ---- Data ---- */}
      <SectionHeader right={
        <Link href="/admin/data" className="pressable font-mono text-[11px] text-ink-3 transition-colors hover:text-agent">
          Data ops →
        </Link>
      }>Data</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Series coverage" tone={covTone}
          value={cov ? `${cov.ok}/${cov.series}` : "0/0"}
          delta={cov && cov.broken > 0 ? `${cov.broken} broken` : undefined} deltaTone="loss"
          sub={cov?.last_sync ? `freshest tail ${ago(cov.last_sync, now)}` : "nothing synced yet"} />
        <StatCard label="Bars stored" value={snap.bars_rows.toLocaleString()}
          sub={`${snap.series_rows} series in the vault`} />
        <StatCard label="Quotes cached" value={snap.quote_rows} sub="symbols warm" />
        <StatCard label="AI brain" value={brain.provider === "scripted" ? "none" : brain.provider}
          tone={brain.provider === "scripted" ? "warn" : "default"}
          sub={brain.provider === "scripted" ? "rules fallback in use" : brain.model} />
      </div>

      {/* ---- The tape: what just happened, and who moved ---- */}
      <div className="mt-9 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Order tape</h2>
            <span aria-hidden className="h-px min-w-4 flex-1 bg-hairline" />
          </div>
          <div className="panel mt-2 divide-y divide-hairline overflow-hidden">
            {pulse.length === 0 ? (
              <EmptyState title="No orders yet" hint="Tickets show up here the moment a trader submits one." />
            ) : pulse.map((p, i) => (
              <MetricRow key={i}
                lead={<Badge tone={p.side === "buy" ? "gain" : "loss"}>{p.side}</Badge>}
                label={p.symbol}
                sub={`${p.type} · ${p.name}`}
                value={
                  <Badge tone={p.status === "filled" ? "gain" : p.status === "rejected" ? "loss" : "muted"}>
                    {p.status}
                  </Badge>
                }
                valueSub={ago(p.createdAt, now)}
              />
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Movers</h2>
            <span aria-hidden className="h-px min-w-4 flex-1 bg-hairline" />
            <Link href="/admin/users" className="pressable shrink-0 font-mono text-[11px] text-ink-3 transition-colors hover:text-agent">
              Users →
            </Link>
          </div>
          <div className="panel mt-2 divide-y divide-hairline overflow-hidden">
            {movers.length === 0 ? (
              <EmptyState title="No accounts yet" hint="Every new trader starts with $100,000 simulated." />
            ) : movers.map((m) => (
              <MetricRow key={m.id} href={`/admin/users/${m.id}`}
                label={m.name} sub={m.email}
                value={`${m.ret >= 0 ? "+" : "−"}${Math.abs(m.ret * 100).toFixed(1)}%`}
                valueSub={fmtUsd(m.equity)}
                tone={m.ret > 0 ? "gain" : m.ret < 0 ? "loss" : "default"}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
