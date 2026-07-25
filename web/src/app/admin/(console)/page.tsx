import Link from "next/link";
import { brainStatus } from "@/server/llm";
import { liveFeedStatus } from "@/server/live-feed";
import { getPlatformConfig } from "@/server/platform";
import { getOverview, computeHealth } from "@/server/admin-metrics";
import { StatCard, StatusChip, SectionHeader, Sparkline } from "./ui";

/*
  Overview — the command center. Opens with a health verdict and the money at
  risk, then the live pulse. Every read is straight from Postgres; the whole
  page is a handful of parallel queries on one pooled connection.
*/
export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const fmtUsd = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}`;
const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

const BAND: Record<"nominal" | "degraded" | "critical", { ring: string; text: string; label: string }> = {
  nominal: { ring: "border-gain/40 bg-gain/8", text: "text-gain", label: "All systems nominal" },
  degraded: { ring: "border-gold/40 bg-gold/8", text: "text-gold", label: "Degraded" },
  critical: { ring: "border-loss/50 bg-loss/10", text: "text-loss", label: "Critical" },
};

export default async function AdminOverview() {
  const now = Date.now();
  const brain = brainStatus();
  const feed = liveFeedStatus();
  const cfg = await getPlatformConfig();
  const { snap, spark, pulse, top, bottom } = await getOverview(now);

  const feedOk: boolean | "connecting" | "off" =
    !feed.enabled ? "off" : (feed.stocks.authed || feed.crypto.authed) ? true : "connecting";
  const health = computeHealth({
    lastCron: snap.last_cron, now, errors1h: snap.errors1h, calls1h: snap.calls1h,
    feedOk, brainOk: brain.provider !== "scripted", halted: cfg.tradingHalted, paused: cfg.agentsPaused,
  });
  const band = BAND[health.status];
  const winners = snap.profitable + snap.underwater;
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
      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Overview</h1>
        <span className="font-mono text-[11px] text-ink-4">live · {new Date(now).toLocaleTimeString()}</span>
      </div>

      {/* Health verdict */}
      <section className={`mt-4 rounded-2xl border p-4 ${band.ring}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${health.status === "nominal" ? "bg-gain" : health.status === "degraded" ? "bg-gold" : "bg-loss"} ${health.status !== "nominal" ? "animate-pulse" : ""}`} />
            <h2 className={`font-display text-lg font-bold ${band.text}`}>{band.label}</h2>
            {(() => {
              const n = health.signals.filter((s) => s.level !== "ok").length;
              return n > 0 ? (
                <span className="font-mono text-[11px] text-ink-4">
                  {n} signal{n === 1 ? " needs" : "s need"} a look
                </span>
              ) : null;
            })()}
          </div>
          <Link href="/admin/system" className="pressable font-mono text-[11px] text-ink-3 hover:text-ink-1">Controls →</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {health.signals.map((s) => <StatusChip key={s.label} level={s.level} label={s.label} detail={s.detail} />)}
        </div>
      </section>

      {/* Money at risk */}
      <SectionHeader>Simulated capital</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total AUM" value={fmtUsd(snap.aum)} sub={`across ${snap.users} accounts`} tone="accent" />
        <StatCard label="Day P&L" value={signed(snap.day_pnl)} sub="all accounts, since ET open" tone={snap.day_pnl > 0 ? "gain" : snap.day_pnl < 0 ? "loss" : "default"} />
        <StatCard label="In profit" value={snap.profitable} sub={winners ? `${Math.round((snap.profitable / winners) * 100)}% of active books` : "no books yet"} tone="gain" />
        <StatCard label="Underwater" value={snap.underwater} sub="below the $100k start" tone={snap.underwater > 0 ? "loss" : "default"} />
      </div>

      {/* Live pulse */}
      <SectionHeader right={<span className="font-mono text-[11px] text-ink-4">last 24h</span>}>Activity</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Orders · 24h</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="tnum text-2xl font-semibold text-ink-1">{snap.orders24}</p>
            <Sparkline data={spark} className="h-8 w-24" />
          </div>
          <p className="mt-0.5 text-[11px] text-ink-4">{snap.fills24} filled · {snap.rejects24} rejected</p>
        </div>
        <StatCard label="New traders · 24h" value={snap.new_users24} sub={`${snap.sessions} sessions live now`} tone={snap.new_users24 > 0 ? "gain" : "default"} />
        <StatCard label="Analysts live" value={snap.agents_running} sub="running right now" tone="accent" />
        <StatCard label="Assistant · 24h" value={snap.chats24} sub="desk + Tars messages" />
      </div>

      {/* Data plane */}
      <SectionHeader right={<Link href="/admin/data" className="pressable font-mono text-[11px] text-ink-3 hover:text-ink-1">Data ops →</Link>}>Data plane</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Upstream · 1h" value={snap.calls1h} sub={`${snap.errors1h} errors`} tone={snap.errors1h > 20 ? "loss" : snap.errors1h > 0 ? "warn" : "default"} />
        <StatCard label="Bars stored" value={snap.bars_rows.toLocaleString()} sub={`${snap.series_rows} series in the vault`} />
        <StatCard label="Quotes cached" value={snap.quote_rows} sub="symbols warm" />
        <StatCard label="AI brain" value={brain.provider === "scripted" ? "none" : brain.provider} sub={brain.provider === "scripted" ? "rules fallback" : brain.model} tone={brain.provider === "scripted" ? "warn" : "default"} />
      </div>

      {/* Pulse + movers */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Recent orders</h2>
          <section className="panel mt-2 overflow-hidden">
            {pulse.length === 0 && <p className="px-4 py-8 text-center text-xs text-ink-4">No orders yet.</p>}
            {pulse.map((p, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 text-xs last:border-0">
                <span className={`font-mono text-[10px] uppercase ${p.side === "buy" ? "text-gain" : "text-loss"}`}>{p.side}</span>
                <span className="font-medium text-ink-1">{p.symbol}</span>
                <span className="font-mono text-[10px] uppercase text-ink-4">{p.type}</span>
                <span className={`font-mono text-[10px] uppercase ${p.status === "filled" ? "text-gain" : p.status === "rejected" ? "text-loss" : "text-ink-4"}`}>{p.status}</span>
                <span className="ml-auto truncate text-ink-4">{p.name}</span>
                <span className="tnum shrink-0 text-ink-4">{ago(p.createdAt)}</span>
              </div>
            ))}
          </section>
        </div>
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Movers</h2>
          <section className="panel mt-2 divide-y divide-hairline">
            {movers.length === 0 && <p className="px-4 py-8 text-center text-xs text-ink-4">No accounts yet.</p>}
            {movers.map((m, i) => (
              <Link key={i} href={`/admin/users/${m.id}`}
                className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-bg3/40">
                <span className="truncate font-medium text-ink-1">{m.name}</span>
                <span className={`tnum ml-auto shrink-0 ${m.ret > 0 ? "text-gain" : m.ret < 0 ? "text-loss" : "text-ink-3"}`}>
                  {m.ret >= 0 ? "+" : ""}{(m.ret * 100).toFixed(1)}%
                </span>
                <span className="tnum w-16 shrink-0 text-right text-ink-4">{fmtUsd(m.equity)}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
