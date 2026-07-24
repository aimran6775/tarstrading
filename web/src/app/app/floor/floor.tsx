"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { usd, pct } from "@/components/trading/shared";
import { Spark } from "@/components/market-card";
import FloorTour from "./tour";

// The three.js/WebGL hero is heavy — keep it out of the Floor's initial JS and
// hydrate it after paint (the landing does the same).
const OrbitalMarket = dynamic(() => import("@/components/orbital-market"), { ssr: false });

/*
  The Trading Floor dashboard — home base, glanceable and alive. A 3D orbital
  hero over a settling equity count-up, then everything that matters one card
  away: your book, your learning, your edge (does the academy show up in your
  trading?), your agents, the market's pulse.
*/

type Data = {
  name: string; equity: number; cash: number; dayStart: number; curve: number[];
  positions: { symbol: string; qty: number; value: number; openPnl: number }[];
  openPnl: number; invested: number; openOrders: number;
  agentsRunning: number; agentsAlloc: number; agentName: string | null;
  movers: { symbol: string; price: number; changePercent: number }[];
  journal: { symbol: string; pnl: number | null; createdAt: number }[];
  academy: {
    xp: number; lessonsDone: number; totalLessons: number; stagesCleared: number; totalStages: number;
    streak: number; missions: number; totalMissions: number; replays: number; totalReplays: number;
    nextId: string | null; nextTitle: string | null;
  };
  edge: { trades: number; wins: number; realizedPnl: number; maxDD: number };
  system: { marketOpen: boolean; feed: string; brain: string };
};

// Count toward `target`, always animating from wherever the number currently
// is (a ref), so the first mount eases up from `from` AND every live update
// glides smoothly from the last shown value instead of snapping or restarting.
function useCountUp(target: number, from: number, ms = 1100) {
  const rm = useReducedMotion();
  const [v, setV] = useState(rm ? target : from);
  const vRef = useRef(rm ? target : from);
  useEffect(() => {
    if (rm) { setV(target); vRef.current = target; return; }
    const start = vRef.current; let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
      const val = start + (target - start) * e;
      setV(val); vRef.current = val;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, rm]);
  return v;
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.04 * i, ease: [0.32, 0.72, 0, 1] as const },
});

export default function Floor({ data }: { data: Data }) {
  const rm = useReducedMotion();
  // The headline equity ticks live: poll the account (which reconciles + marks
  // every held position to the real-time feed) and glide the count-up to it.
  const [acct, setAcct] = useState({ equity: data.equity, dayStart: data.dayStart });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/account", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (alive && d?.account) setAcct({ equity: d.account.equity, dayStart: d.account.dayStartEquity });
      } catch { /* a missed poll is fine — the next one heals it */ }
    };
    const id = setInterval(load, 12_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const dayPnl = acct.equity - acct.dayStart;
  const dayPct = acct.dayStart ? dayPnl / acct.dayStart : 0;
  const shown = useCountUp(acct.equity, data.dayStart);
  const tone = (n: number) => (n > 0 ? "gain" : n < 0 ? "loss" : "ink-2");

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  const a = data.academy;
  const learnPct = a.totalLessons ? a.lessonsDone / a.totalLessons : 0;
  const winRate = data.edge.trades ? data.edge.wins / data.edge.trades : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10">
      <h1 className="sr-only">Trading Floor</h1>
      <FloorTour hasAgents={data.agentsRunning > 0} />

      {/* ---- hero ---- */}
      <motion.section {...(rm ? {} : rise(0))}
        className="relative overflow-hidden rounded-3xl border border-hairline">
        <div className="absolute inset-0 opacity-70"><OrbitalMarket /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg0 via-bg0/60 to-bg0/20" aria-hidden />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="text-sm text-ink-3">{greeting}, {data.name.split(" ")[0]}.</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="sim-mark">PAPER</span>
              <span className="text-[11px] uppercase tracking-[0.25em] text-ink-4">Total equity</span>
            </div>
            <p className="tnum mt-2 font-display text-5xl font-bold text-ink-1 md:text-6xl">{usd(shown, 0)}</p>
            <div className={`tnum mt-2 flex items-center gap-2 text-sm text-${tone(dayPnl)}`}>
              <span>{dayPnl >= 0 ? "▲" : "▼"}</span>
              <span>{usd(Math.abs(dayPnl))}</span>
              <span className="text-ink-4">·</span>
              <span>{pct(dayPct)}</span>
              <span className="text-ink-4">today</span>
            </div>
            <p className="tnum mt-1 text-xs text-ink-4">{usd(data.cash, 0)} buying power · {usd(data.invested, 0)} invested</p>
          </div>
          <div className="w-full md:w-72">
            {data.curve.length > 1 ? (
              <div className="rounded-2xl border border-hairline bg-bg1/60 p-3 backdrop-blur">
                <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-ink-4">Equity curve</p>
                <Spark points={data.curve} className="h-16 w-full" />
              </div>
            ) : (
              <div className="rounded-2xl border border-hairline bg-bg1/60 p-3 text-xs text-ink-4 backdrop-blur">
                Your equity curve draws itself as you trade.
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* ---- KPI strip ---- */}
      <motion.div {...(rm ? {} : rise(1))} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <Kpi label="Cash" value={usd(data.cash, 0)} />
        <Kpi label="Invested" value={usd(data.invested, 0)} />
        <Kpi label="Open P&L" value={usd(data.openPnl)} tone={tone(data.openPnl)} />
        <Kpi label="Positions" value={String(data.positions.length)} />
        <Kpi label="Open orders" value={String(data.openOrders)} />
        <Kpi label="Agents live" value={String(data.agentsRunning)} tone={data.agentsRunning ? "agent" : "ink-2"} />
      </motion.div>

      {/* ---- panels ---- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Book */}
        <Panel i={2} title="Your book" href="/app" cta="Open the desk">
          {data.positions.length === 0 ? (
            <Empty text="No positions yet." action="Make your first trade" href="/app" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.positions.slice(0, 5).map((p) => (
                <li key={p.symbol} className="flex items-center justify-between">
                  <Link href={`/app/m/${encodeURIComponent(p.symbol)}`} className="text-sm font-medium text-ink-1 hover:text-gold">{p.symbol}</Link>
                  <div className="flex items-center gap-4">
                    <span className="tnum text-sm text-ink-2">{usd(p.value, 0)}</span>
                    <span className={`tnum w-20 text-right text-sm text-${tone(p.openPnl)}`}>{usd(p.openPnl)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Journey (academy) */}
        <Panel i={3} title="Your journey" href="/app/academy" cta="Enter the academy">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(learnPct * 100)}%` }} />
            </div>
            <span className="tnum shrink-0 text-xs text-ink-3">{a.lessonsDone}/{a.totalLessons}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Chip>{a.stagesCleared}/{a.totalStages} stages</Chip>
            <Chip>{a.xp} XP</Chip>
            <Chip>🔥 {a.streak}d</Chip>
            <Chip>🎯 {a.missions}/{a.totalMissions}</Chip>
            <Chip>⏪ {a.replays}/{a.totalReplays}</Chip>
          </div>
          {a.nextId && (
            <Link href={`/app/academy/${a.nextId}`}
              className="pressable mt-3 inline-block rounded-full bg-gold/12 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20">
              {a.lessonsDone ? "Continue" : "Start"}: {a.nextTitle}
            </Link>
          )}
        </Panel>

        {/* Edge (the outcome loop) */}
        <Panel i={4} title="Your edge" accent="gain">
          <p className="text-sm leading-relaxed text-ink-2">
            Learning shows up as <span className="text-ink-1">discipline</span>, not magic — smaller losses, calmer holds.
            You&apos;ve cleared <span className="text-gold">{a.stagesCleared}</span> of {a.totalStages} stages
            {data.edge.trades > 0 && <> and made <span className="text-ink-1">{data.edge.trades}</span> trades.</>}
            {data.edge.trades === 0 && <>. Make a few trades and your real numbers appear here.</>}
          </p>
          {data.edge.trades >= 3 && (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Mini label="Win rate" value={`${Math.round(winRate * 100)}%`} />
                <Mini label="Realized" value={usd(data.edge.realizedPnl)} tone={tone(data.edge.realizedPnl)} />
                <Mini label="Worst drawdown" value={pct(-data.edge.maxDD)} tone={data.edge.maxDD > 0.1 ? "loss" : "ink-1"} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-4">
                The academy&apos;s whole job is keeping that drawdown small enough to survive. Watch it shrink as your process tightens.
              </p>
            </>
          )}
        </Panel>

        {/* Agents */}
        <Panel i={5} title="The floor" href="/app/assistant" cta="Talk to your assistant">
          {data.agentsRunning === 0 ? (
            <Empty text="No analysts working right now." action="Hire one" href="/app/assistant" />
          ) : (
            <div>
              <p className="text-sm text-ink-2">
                <span className="tnum text-ink-1">{data.agentsRunning}</span> analyst{data.agentsRunning === 1 ? "" : "s"} running
                {data.agentName && <> — {data.agentName}{data.agentsRunning > 1 ? " and more" : ""}</>}, deploying{" "}
                <span className="tnum text-ink-1">{usd(data.agentsAlloc, 0)}</span>
                {data.equity > 0 && <span className="text-ink-4"> ({Math.round((data.agentsAlloc / data.equity) * 100)}% of the book)</span>}.
              </p>
            </div>
          )}
        </Panel>

        {/* Markets */}
        <Panel i={6} title="Markets" href="/app" cta="Browse all">
          {data.movers.length === 0 ? (
            <Empty text="Markets warming up." action="Browse" href="/app" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.movers.slice(0, 5).map((m) => (
                <li key={m.symbol} className="flex items-center justify-between">
                  <Link href={`/app/m/${encodeURIComponent(m.symbol)}`} className="text-sm font-medium text-ink-1 hover:text-gold">{m.symbol}</Link>
                  <div className="flex items-center gap-4">
                    <span className="tnum text-sm text-ink-2">{usd(m.price)}</span>
                    <span className={`tnum w-16 text-right text-sm text-${tone(m.changePercent)}`}>{pct(m.changePercent / 100)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Pulse */}
        <Panel i={7} title="Pulse" wide>
          <div className="grid gap-2.5 text-sm sm:grid-cols-3 sm:gap-6">
            <Pulse label="US market" value={data.system.marketOpen ? "Open" : "Closed"} ok={data.system.marketOpen} />
            <Pulse label="Live feed" value={data.system.feed} ok={data.system.feed === "live"} warn={data.system.feed === "connecting"} />
            <Pulse label="AI brain" value={data.system.brain} ok={data.system.brain !== "scripted"} />
          </div>
        </Panel>
      </div>

      <p className="mt-8 text-center text-xs text-ink-4">
        Everything here is simulated. The Floor is your cockpit — the desk, the academy, and your analysts are one tap away.
      </p>
    </main>
  );
}

/* ---- primitives ---- */
function Kpi({ label, value, tone = "ink-1" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 text-lg font-semibold text-${tone}`}>{value}</p>
    </div>
  );
}
function Panel({ i, title, href, cta, accent, wide, children }: {
  i: number; title: string; href?: string; cta?: string; accent?: string; wide?: boolean; children: React.ReactNode;
}) {
  const rm = useReducedMotion();
  return (
    <motion.section {...(rm ? {} : rise(i))} className={`card p-5 ${wide ? "lg:col-span-2" : ""} ${accent ? `border-l-2 border-l-${accent}` : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink-1">{title}</h2>
        {href && cta && <Link href={href} className="text-[11px] text-ink-4 hover:text-gold">{cta} →</Link>}
      </div>
      {children}
    </motion.section>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="tnum rounded-full border border-hairline px-2.5 py-1 text-ink-3">{children}</span>;
}
function Mini({ label, value, tone = "ink-1" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-bg2/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 text-base font-semibold text-${tone}`}>{value}</p>
    </div>
  );
}
function Empty({ text, action, href }: { text: string; action: string; href: string }) {
  return (
    <p className="text-sm text-ink-3">{text}{" "}
      <Link href={href} className="text-gold hover:underline">{action} →</Link>
    </p>
  );
}
function Pulse({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  const color = ok ? "bg-gain" : warn ? "bg-gold" : "bg-ink-4";
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      <span className="flex items-center gap-2 capitalize text-ink-1">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden /> {value}
      </span>
    </div>
  );
}
