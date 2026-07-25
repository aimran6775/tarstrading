"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

/*
  Standings — your trophy case and where you sit against the field. Everything
  here is derived server-side from what actually happened; this view just
  renders it. Two panels: earned/locked badges with live progress bars, and a
  return-ranked leaderboard (same $100k start for everyone, so return is fair).
*/

type Tier = "bronze" | "silver" | "gold";
type Badge = { id: string; name: string; blurb: string; tier: Tier; progress: number; earned: boolean; detail: string };
type Rank = { rank: number; name: string; returnPct: number; equity: number; isYou: boolean };
type Data = {
  achievements: { badges: Badge[]; earned: number; total: number };
  leaderboard: { top: Rank[]; you: Rank | null; totalTraders: number };
};

const usd = (v: number) => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

const TIER_RING: Record<Tier, string> = {
  bronze: "from-[#b0764a] to-[#7a4d2b]",
  silver: "from-[#c9ccd6] to-[#8b8f9c]",
  gold: "from-gold to-[#a9852f]",
};

export default function Standings() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/standings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive && d?.ok) setData({ achievements: d.achievements, leaderboard: d.leaderboard }); })
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6">
        <p className="text-sm text-ink-3">Couldn&apos;t load standings. <button onClick={() => location.reload()} className="text-gold underline">Retry</button></p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6">
      <header className="rise-in relative isolate mb-8 overflow-hidden">
        <span aria-hidden className="ghost pointer-events-none absolute -left-1 -top-5 select-none text-[22vw] leading-none sm:text-[9rem]">
          STANDINGS
        </span>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker mb-2">The desk</p>
            <h1 className="display text-4xl text-ink-1 md:text-5xl">Standings</h1>
            <p className="mt-3 max-w-xl text-sm text-ink-3">Trophies you&apos;ve earned, and where you rank against every trader on the desk.</p>
          </div>
          {/* one bold moment: your standing, lit in gold */}
          {data?.leaderboard.you && (
            <div className="raised edge-gold shrink-0 px-6 py-4 text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-ink-4">Your rank</p>
              <p className="tnum lumina mt-0.5 text-5xl font-bold leading-none text-gold">#{data.leaderboard.you.rank}</p>
              <p className="tnum mt-1.5 text-xs text-ink-3">of {data.leaderboard.totalTraders} traders</p>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rise-in lg:col-span-3" style={{ "--i": 1 } as CSSProperties}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Achievements</h2>
            {data && <span className="tnum text-xs text-ink-4">{data.achievements.earned} / {data.achievements.total}</span>}
          </div>
          {!data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.achievements.badges.map((b) => <BadgeCard key={b.id} b={b} />)}
            </div>
          )}
        </section>

        <section className="rise-in lg:col-span-2" style={{ "--i": 2 } as CSSProperties}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Leaderboard</h2>
            {data && <span className="tnum text-xs text-ink-4">{data.leaderboard.totalTraders} traders</span>}
          </div>
          <div className="raised-2 overflow-hidden">
            {!data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}
              </div>
            ) : (
              <>
                <ul>
                  {data.leaderboard.top.map((r) => <RankRow key={r.rank} r={r} />)}
                </ul>
                {data.leaderboard.you && (
                  <>
                    <div className="border-t border-hairline px-4 py-1 text-center text-[10px] uppercase tracking-widest text-ink-4">Your rank</div>
                    <ul><RankRow r={data.leaderboard.you} /></ul>
                  </>
                )}
                {data.leaderboard.totalTraders <= 1 && (
                  <p className="border-t border-hairline px-4 py-4 text-center text-xs text-ink-4">
                    You&apos;re the only trader so far. <Link href="/app" className="text-gold">Make your mark →</Link>
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function BadgeCard({ b }: { b: Badge }) {
  return (
    <div
      className={`raised lift relative flex flex-col gap-2 p-4 ${b.earned ? "ring-1 ring-gold/20" : "opacity-55"}`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${TIER_RING[b.tier]} ${
          b.earned ? "shadow-[0_0_18px_-4px_var(--glow-gold)]" : "grayscale"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {b.earned
            ? <path d="M20 6L9 17l-5-5" />
            : <><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5L7 21l5-3 5 3-1.5-8.5" /></>}
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-ink-1">{b.name}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-4">{b.blurb}</p>
      </div>
      <div className="mt-auto">
        {!b.earned && (
          <div className="mb-1 h-1 overflow-hidden rounded-full bg-bg3">
            <div className="h-full rounded-full bg-ink-3" style={{ width: `${Math.round(b.progress * 100)}%` }} />
          </div>
        )}
        <p className={`tnum text-[10px] ${b.earned ? "text-gold" : "text-ink-4"}`}>{b.detail}</p>
      </div>
    </div>
  );
}

function RankRow({ r }: { r: Rank }) {
  // Podium via gold + ink tones only — #1 lit gold, #2/#3 stepped ink.
  const podium =
    r.rank === 1
      ? "bg-gold text-ongold shadow-[0_0_12px_-2px_var(--glow-gold)]"
      : r.rank === 2
        ? "bg-ink-2/20 text-ink-1"
        : r.rank === 3
          ? "bg-ink-3/25 text-ink-2"
          : "text-ink-4";
  const isPodium = r.rank <= 3;
  return (
    <li className={`relative flex items-center gap-3 px-4 py-2.5 ${r.isYou ? "bg-gold/10" : r.rank === 1 ? "bg-gold/[0.04]" : ""}`}>
      {r.isYou && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-gold" />}
      <span
        className={`tnum grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
          isPodium ? podium : "text-ink-4"
        }`}
      >
        {r.rank}
      </span>
      <span className={`flex-1 truncate text-sm ${r.rank === 1 ? "font-semibold lumina text-ink-1" : "text-ink-1"}`}>
        {r.name}{r.isYou && <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-gold">You</span>}
      </span>
      <span className="tnum text-right text-xs text-ink-3">{usd(r.equity)}</span>
      <span className={`tnum w-20 text-right text-xs font-semibold ${r.returnPct > 0 ? "text-gain" : r.returnPct < 0 ? "text-loss" : "text-ink-3"}`}>
        {pct(r.returnPct)}
      </span>
    </li>
  );
}
