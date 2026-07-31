"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import { usd, pct, marketHrefFor } from "@/components/trading/shared";
import { Spark } from "@/components/market-card";
import { Icon } from "@/components/icons";
import FloorTour from "./tour";

// The hero backdrop is real market footage — one <video>, no WebGL. Hydrate
// after paint to keep it out of the Floor's initial JS.
const VideoHero = dynamic(() => import("@/components/video-hero"), { ssr: false });

/*
  The Trading Floor dashboard — a cinematic command deck. Real market footage
  under a monumental equity count-up, one orchestrated rise-in as the room
  boots, then everything that matters one card away: your book, your learning,
  your edge (does the academy show up in your trading?), your agents, the
  market's pulse.
*/

type Data = {
  name: string; fundName: string | null; equity: number; cash: number; dayStart: number; curve: number[];
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

/* ---- one orchestrated load sequence -------------------------------------
   A single variants tree: the page container staggers its sections (hero,
   KPI strip, panels, sign-off) in document order; the hero and the KPI strip
   run a nested micro-stagger of their own children. Reduced motion collapses
   the whole tree to its final state via `initial={false}` at the root. */
const EASE = [0.32, 0.72, 0, 1] as const;
const deck: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const hero: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, staggerChildren: 0.08, delayChildren: 0.05 } },
};
const strip: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, staggerChildren: 0.045 } },
};

/* Tone → class maps. Written out in full so Tailwind sees every class. */
type Tone = "gain" | "loss" | "agent" | "ink-1" | "ink-2";
const TONE: Record<Tone, string> = {
  gain: "text-gain", loss: "text-loss", agent: "text-agent", "ink-1": "text-ink-1", "ink-2": "text-ink-2",
};

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
    const id = setInterval(() => { if (typeof document !== "undefined" && document.hidden) return; load(); }, 12_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const dayPnl = acct.equity - acct.dayStart;
  const dayPct = acct.dayStart ? dayPnl / acct.dayStart : 0;
  const shown = useCountUp(acct.equity, data.dayStart);
  const tone = (n: number): Tone => (n > 0 ? "gain" : n < 0 ? "loss" : "ink-2");

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  const a = data.academy;
  const learnPct = a.totalLessons ? a.lessonsDone / a.totalLessons : 0;
  const winRate = data.edge.trades ? data.edge.wins / data.edge.trades : 0;

  // Realized-P&L trajectory from the journal (oldest → newest, cumulative) —
  // the micro-sparkline under the P&L jewel once at least two trades exist.
  const realizedSpark = (() => {
    const out: number[] = []; let acc = 0;
    for (const j of [...data.journal].reverse()) if (j.pnl != null) { acc += j.pnl; out.push(acc); }
    return out;
  })();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10">
      <h1 className="sr-only">Trading Floor</h1>
      <FloorTour hasAgents={data.agentsRunning > 0} />

      <motion.div variants={deck} initial={rm ? false : "hidden"} animate="show">
        {/* ---- hero: the monumental number over the room ----
             The one place we spend boldness: a gold aura bleeds from behind the
             card, a ghosted "EQUITY" stands monumental behind the count-up, and
             the number itself catches a faint gold light. edge-gold rides the
             wrapper's top edge (the card clips its own overflow). */}
        <div className="edge-gold relative">
          <div aria-hidden className="aura aura-gold" />
          <motion.section variants={hero}
            className="relative z-10 overflow-hidden rounded-3xl border border-hairline shadow-[var(--shadow-3)]">
            <VideoHero dim={0.55} />
            {/* A quiet vignette pulls the eye to the centerpiece. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,transparent_0%,oklch(0.1_0.02_278/0.42)_100%)]" />
            {/* Scene contract: everything below sits over dark footage in BOTH
                themes — scene-ink only, never theme ink tokens. */}
            <div className="relative flex min-h-[360px] flex-col p-4 sm:p-6 md:min-h-[440px] md:p-8">
              <motion.div variants={item} className="flex items-center justify-between gap-3">
                <FundMasthead greeting={greeting} name={data.name} fundName={data.fundName} />
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="scene-ink-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${data.system.marketOpen ? "bg-gain pulse-ring" : "bg-ink-4"}`} />
                    {data.system.marketOpen ? "Market open" : "Market closed"}
                  </span>
                  <span className="sim-mark">PAPER</span>
                </div>
              </motion.div>

              <div className="relative flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-12">
                {/* The editorial ghost — scene-light in BOTH themes (it lives over
                    the always-dark footage), so its stroke is fixed, not tokened. */}
                <span aria-hidden
                  className="ghost pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[26vw] sm:text-[15rem]"
                  style={{ WebkitTextStrokeColor: "oklch(0.96 0.008 264 / 0.07)" }}>
                  EQUITY
                </span>
                <motion.p variants={item} className="scene-ink-3 relative font-mono text-[11px] uppercase tracking-[0.35em]">Total equity</motion.p>
                <motion.p variants={item}
                  className="scene-ink tnum relative mt-3 text-5xl font-bold leading-none tracking-tight sm:text-6xl md:text-7xl"
                  style={{ textShadow: "0 2px 28px oklch(0 0 0 / 0.5), 0 0 44px oklch(from var(--gold) l c h / 0.30)" }}>
                  {usd(shown, 0)}
                </motion.p>
                <motion.div variants={item}
                  className={`tnum relative mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm backdrop-blur-sm ${dayPnl > 0 ? "border-gain/30 text-gain" : dayPnl < 0 ? "border-loss/30 text-loss" : "scene-ink-2 border-white/12"}`}
                  style={{ background: "oklch(0.16 0.02 280 / 0.5)" }}>
                  <span aria-hidden>{dayPnl >= 0 ? "▲" : "▼"}</span>
                  <span>{usd(Math.abs(dayPnl))}</span>
                  <span className="opacity-40">·</span>
                  <span>{pct(dayPct)}</span>
                  <span className="scene-ink-3 text-xs">today</span>
                </motion.div>
                <motion.p variants={item} className="scene-ink-3 tnum relative mt-3 text-xs">
                  {usd(data.cash, 0)} buying power · {usd(data.invested, 0)} invested
                </motion.p>
              </div>

              <motion.div variants={item}>
                {data.curve.length > 1 ? (
                  <div className="scene-panel relative overflow-hidden rounded-2xl border border-white/10 p-3.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="scene-ink-3 font-mono text-[10px] uppercase tracking-[0.2em]">Equity curve</p>
                      <span className="scene-ink-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]">
                        <span aria-hidden className="h-1 w-1 rounded-full bg-gold" /> live
                      </span>
                    </div>
                    <Spark points={data.curve} className="h-14 w-full sm:h-16" fill />
                  </div>
                ) : (
                  <div className="scene-panel scene-ink-3 rounded-2xl border border-white/10 p-3.5 text-xs">
                    Your equity curve draws itself as you trade.
                  </div>
                )}
              </motion.div>
            </div>
          </motion.section>
        </div>

        {/* ---- KPI jewels ---- */}
        <motion.div variants={strip} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Kpi label="Cash" value={usd(data.cash, 0)} />
          <Kpi label="Invested" value={usd(data.invested, 0)} />
          <Kpi label="Open P&L" value={usd(data.openPnl)} tone={tone(data.openPnl)} spark={realizedSpark} />
          <Kpi label="Positions" value={String(data.positions.length)} />
          <Kpi label="Open orders" value={String(data.openOrders)} />
          <Kpi label="Agents live" value={String(data.agentsRunning)} tone={data.agentsRunning ? "agent" : "ink-2"} />
        </motion.div>

        {/* ---- panels ---- */}
        <div className="mt-5 grid gap-4 sm:gap-5 lg:grid-cols-2">
          {/* Book */}
          <Panel title="Your book" index="01" href="/app" cta="Open the desk">
            {data.positions.length === 0 ? (
              <Empty text="No positions yet." action="Make your first trade" href="/app" />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.positions.slice(0, 5).map((p) => (
                  <li key={p.symbol} className="flex items-center justify-between">
                    <Link href={marketHrefFor(p.symbol)} className="text-sm font-medium text-ink-1 hover:text-gold">{p.symbol}</Link>
                    <div className="flex items-center gap-4">
                      <span className="tnum text-sm text-ink-2">{usd(p.value, 0)}</span>
                      <span className={`tnum w-20 text-right text-sm ${TONE[tone(p.openPnl)]}`}>{usd(p.openPnl)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Journey (academy) */}
          <Panel title="Your journey" index="02" href="/app/academy" cta="Enter the academy">
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3">
                <div className="h-full rounded-full"
                  style={{ width: `${Math.round(learnPct * 100)}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))", boxShadow: "0 0 12px oklch(from var(--gold) l c h / 0.4)" }} />
              </div>
              <span className="tnum shrink-0 text-xs text-ink-3">{a.lessonsDone}/{a.totalLessons}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Chip>{a.stagesCleared}/{a.totalStages} stages</Chip>
              <Chip><Icon.GoldBlock className="h-3 w-3" /> {a.xp}</Chip>
              <Chip><Icon.Flame className="h-3 w-3 text-gold" /> {a.streak}d</Chip>
              <Chip><Icon.Target className="h-3 w-3 text-ink-3" /> {a.missions}/{a.totalMissions}</Chip>
              <Chip><Icon.Journal className="h-3 w-3 text-ink-3" /> {a.replays}/{a.totalReplays}</Chip>
            </div>
            {a.nextId && (
              <Link href={`/app/academy/${a.nextId}`}
                className="pressable mt-3 inline-block rounded-full bg-gold/12 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20">
                {a.lessonsDone ? "Continue" : "Start"}: {a.nextTitle}
              </Link>
            )}
          </Panel>

          {/* Edge (the outcome loop) — the editorial moment of the deck */}
          <Panel title="Your edge" index="03" accent="gain">
            <blockquote className="border-l-2 border-l-gold/60 pl-4 font-display text-xl font-bold leading-snug tracking-tight text-ink-1 sm:text-2xl">
              Learning shows up as discipline, not magic — smaller losses, calmer holds.
            </blockquote>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              You&apos;ve cleared <span className="tnum text-gold">{a.stagesCleared}</span> of <span className="tnum">{a.totalStages}</span> stages
              {data.edge.trades > 0 && <> and made <span className="tnum text-ink-1">{data.edge.trades}</span> trades.</>}
              {data.edge.trades === 0 && <>. Make a few trades and your real numbers appear here.</>}
            </p>
            {data.edge.trades >= 3 && (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.round(winRate * 100)}%`, background: "linear-gradient(90deg, var(--gold-deep), var(--gold))" }} />
                  </div>
                  <span className="tnum shrink-0 text-xs text-ink-3">{Math.round(winRate * 100)}% win</span>
                </div>
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
          <Panel title="The floor" index="04" href="/app/assistant" cta="Talk to your assistant" accent={data.agentsRunning ? "agent" : undefined}>
            {data.agentsRunning === 0 ? (
              <Empty text="No analysts working right now." action="Hire one" href="/app/assistant" />
            ) : (
              <div>
                <p className="text-sm text-ink-2">
                  <span className="tnum text-ink-1">{data.agentsRunning}</span> analyst{data.agentsRunning === 1 ? "" : "s"} running
                  {data.agentName && <> — {data.agentName}{data.agentsRunning > 1 ? " and more" : ""}</>}, deploying{" "}
                  <span className="tnum text-ink-1">{usd(data.agentsAlloc, 0)}</span>
                  {data.equity > 0 && <span className="tnum text-ink-4"> ({Math.round((data.agentsAlloc / data.equity) * 100)}% of the book)</span>}.
                </p>
              </div>
            )}
          </Panel>

          {/* Markets */}
          <Panel title="Markets" index="05" href="/app" cta="Browse all">
            {data.movers.length === 0 ? (
              <Empty text="Markets warming up." action="Browse" href="/app" />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.movers.slice(0, 5).map((m) => (
                  <li key={m.symbol} className="group relative overflow-hidden rounded-lg bg-bg1/50 py-1.5 pl-3.5 pr-2.5 transition-colors hover:bg-bg2/60">
                    {/* Movers carry only a single delta, not a series — so the
                        "energy" is a glowing tone rail, not a fabricated spark. */}
                    <span aria-hidden
                      className={`absolute inset-y-1 left-0 w-[3px] rounded-full ${m.changePercent > 0 ? "bg-gain shadow-[0_0_10px_-2px_var(--gain)]" : m.changePercent < 0 ? "bg-loss shadow-[0_0_10px_-2px_var(--loss)]" : "bg-ink-4"}`} />
                    <div className="flex items-center justify-between">
                      <Link href={`/app/m/${encodeURIComponent(m.symbol)}`} className="text-sm font-medium text-ink-1 hover:text-gold">{m.symbol}</Link>
                      <div className="flex items-center gap-4">
                        <span className="tnum text-sm text-ink-2">{usd(m.price)}</span>
                        <span className={`tnum w-16 text-right text-sm ${TONE[tone(m.changePercent)]}`}>{pct(m.changePercent / 100)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Pulse */}
          <Panel title="Pulse" index="06" wide>
            <div className="grid gap-2.5 text-sm sm:grid-cols-3 sm:gap-6">
              <Pulse label="US market" value={data.system.marketOpen ? "Open" : "Closed"} ok={data.system.marketOpen} />
              <Pulse label="Live feed" value={data.system.feed} ok={data.system.feed === "live"} warn={data.system.feed === "connecting"} />
              <Pulse label="AI brain" value={data.system.brain} ok={data.system.brain !== "scripted"} />
            </div>
          </Panel>
        </div>

        <motion.p variants={item} className="mt-10 text-center text-xs text-ink-4">
          Everything here is simulated. The Floor is your cockpit — the desk, the academy, and your analysts are one tap away.
        </motion.p>
      </motion.div>
    </main>
  );
}

/* ---- primitives ---- */
/*
  The fund masthead — your desk's identity, over the hero footage. Unnamed
  desks get the greeting plus a quiet "Name your fund" affordance; named ones
  fly the fund's flag with the greeting beneath. Renaming is inline: click the
  name (or the affordance), type, Enter. Scene contract: scene-ink only.
*/
function FundMasthead({ greeting, name, fundName }: { greeting: string; name: string; fundName: string | null }) {
  const [fund, setFund] = useState(fundName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fundName ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = draft.replace(/\s+/g, " ").trim().slice(0, 40);
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundName: next }),
      });
      const d = await res.json();
      if (d.ok) { setFund(d.fundName); setEditing(false); }
    } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}
        className="scene-panel flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 py-1.5">
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
          placeholder="Name your fund…" maxLength={40}
          className="scene-ink w-44 bg-transparent text-sm outline-none placeholder:text-[oklch(0.55_0.02_264)] sm:w-56"
          aria-label="Fund name" />
        <button type="submit" disabled={saving}
          className="pressable font-mono text-[10px] uppercase tracking-[0.15em] text-gold disabled:opacity-50">
          {saving ? "…" : "Save"}
        </button>
      </form>
    );
  }

  return fund ? (
    <button onClick={() => { setDraft(fund); setEditing(true); }}
      className="pressable min-h-11 text-left" title="Rename your fund">
      <span className="scene-ink font-display text-base font-extrabold uppercase tracking-wide sm:text-lg">{fund}</span>
      <span className="scene-ink-3 block text-xs">{greeting}, {name.split(" ")[0]}.</span>
    </button>
  ) : (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <p className="scene-ink-2 text-sm">{greeting}, {name.split(" ")[0]}.</p>
      <button onClick={() => { setDraft(""); setEditing(true); }}
        className="pressable scene-ink-3 min-h-11 font-mono text-[10px] uppercase tracking-[0.2em] underline decoration-dotted underline-offset-4 hover:text-gold">
        Name your fund
      </button>
    </div>
  );
}

function Kpi({ label, value, tone = "ink-1", spark }: { label: string; value: string; tone?: Tone; spark?: number[] }) {
  const hasSpark = !!spark && spark.length > 1;
  return (
    <motion.div variants={item} style={{ borderRadius: 16 }}
      className={`raised lift relative overflow-hidden p-3.5 ${hasSpark ? "pb-6" : ""}`}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
      <p className={`tnum relative mt-1 text-xl font-semibold ${TONE[tone]}`}>{value}</p>
      {hasSpark && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-7 opacity-50">
          <Spark points={spark} className="h-full w-full" fill />
        </div>
      )}
    </motion.div>
  );
}
function Panel({ title, index, href, cta, accent, wide, children }: {
  title: string; index?: string; href?: string; cta?: string; accent?: "gain" | "agent"; wide?: boolean; children: React.ReactNode;
}) {
  const edge = accent === "gain" ? "border-l-2 border-l-gain" : accent === "agent" ? "border-l-2 border-l-agent" : "";
  return (
    <motion.section variants={item}
      className={`raised ${href ? "lift" : ""} p-5 sm:p-6 ${wide ? "lg:col-span-2" : ""} ${edge}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {index && <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-4">{index}</p>}
          <h2 className="font-display text-base font-bold text-ink-1">{title}</h2>
        </div>
        {href && cta && <Link href={href} className="shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4 hover:text-gold">{cta} →</Link>}
      </div>
      {children}
    </motion.section>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="tnum rounded-full border border-hairline px-2.5 py-1 text-ink-3">{children}</span>;
}
function Mini({ label, value, tone = "ink-1" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-hairline bg-bg2/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 text-base font-semibold ${TONE[tone]}`}>{value}</p>
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
  const color = ok ? "bg-gain shadow-[0_0_8px_var(--gain)]" : warn ? "bg-gold shadow-[0_0_8px_var(--gold)]" : "bg-ink-4";
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      <span className="flex items-center gap-2 capitalize text-ink-1">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden /> {value}
      </span>
    </div>
  );
}
