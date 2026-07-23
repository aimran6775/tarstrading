"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SCENARIOS, totalReplayXP, type Scenario, type Bar } from "@/lib/academy/scenarios";

/*
  Historical replay — trade a famous market moment bar by bar, blind to the
  future. Start with $10,000, go long or sit in cash, advance one day at a time,
  and at the end see your return against buy-and-hold and the real story. The
  point isn't to "win" — it's to feel how fear and FOMO drive the mistakes the
  lessons warn about, with nothing but practice money at stake.
*/

const STAKE = 10_000;
const pctStr = (f: number) => (f >= 0 ? "+" : "") + (f * 100).toFixed(1) + "%";
const usd = (n: number) => "$" + Math.round(n).toLocaleString();

type Result = { scenarioId: string; playerReturn: number; buyHoldReturn: number };

export default function Replay({ initialResults }: { initialResults: Result[] }) {
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(initialResults.map((r) => [r.scenarioId, r])));
  const [active, setActive] = useState<Scenario | null>(null);

  const earnedXP = SCENARIOS.reduce((s, sc) => s + (results[sc.id] ? sc.xp : 0), 0);

  if (active) {
    return <Player scenario={active}
      onExit={() => setActive(null)}
      onComplete={(playerReturn, buyHoldReturn) => {
        setResults((r) => ({ ...r, [active.id]: { scenarioId: active.id, playerReturn, buyHoldReturn } }));
        fetch("/api/academy/replay", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId: active.id, playerReturn, buyHoldReturn }),
        }).catch(() => { /* result stays local */ });
      }} />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker mb-2"><Link href="/app/academy" className="hover:underline">Academy</Link> · Replay</p>
          <h1 className="display text-3xl text-ink-1 md:text-4xl">Trade history blind.</h1>
        </div>
        <p className="tnum text-sm text-ink-3"><span className="text-gold">{earnedXP}</span> / {totalReplayXP} XP</p>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
        Step into a famous market moment with $10,000 and no idea what happens next. Go long, sit in cash, or
        buy the fear — one day at a time. Then see how you did against buy-and-hold, and what really happened.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {SCENARIOS.map((sc) => {
          const done = results[sc.id];
          return (
            <button key={sc.id} onClick={() => setActive(sc)}
              className="pressable card overflow-hidden border-l-2 border-l-agent p-5 text-left transition-colors hover:border-l-gold hover:bg-bg2/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ink-1">{sc.title}</h2>
                    <span className="tnum rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-4">{sc.symbol} · {sc.era}</span>
                    {done && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-gold">PLAYED</span>}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{sc.hook}</p>
                  {done && (
                    <p className="tnum mt-2 text-xs text-ink-4">
                      You: <span className={done.playerReturn >= 0 ? "text-gain" : "text-loss"}>{pctStr(done.playerReturn)}</span>
                      {" · "}Buy &amp; hold: <span className={done.buyHoldReturn >= 0 ? "text-gain" : "text-loss"}>{pctStr(done.buyHoldReturn)}</span>
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-4">+{sc.xp} XP</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-8 rounded-xl border border-hairline bg-bg2/40 px-4 py-3 text-xs leading-relaxed text-ink-4">
        These series are faithful <span className="text-ink-3">reconstructions</span> — pinned to each episode&apos;s real
        peak and trough dates and price levels — not tick-for-tick history (the data plan can&apos;t reach these years). The
        shape and the lesson are real; the daily wiggles are generated.
      </p>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

type Trade = { step: number; type: "buy" | "sell"; price: number };

function Player({ scenario, onExit, onComplete }: {
  scenario: Scenario; onExit: () => void; onComplete: (playerReturn: number, buyHoldReturn: number) => void;
}) {
  const bars = scenario.bars;
  const last = bars.length - 1;
  const [step, setStep] = useState(0);
  const [long, setLong] = useState(false);
  const [cash, setCash] = useState(STAKE);
  const [shares, setShares] = useState(0);
  const [entry, setEntry] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [done, setDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const price = bars[step].c;
  const equity = long ? shares * price : cash;
  const bnhShares = STAKE / bars[0].c;
  const bnhEquity = bnhShares * price;
  const openPnl = long ? (price - entry) * shares : 0;
  // Live returns; when `done`, step === last so these are also the finals.
  const playerReturn = equity / STAKE - 1;
  const buyHoldReturn = bnhEquity / STAKE - 1;

  function buy() {
    if (long || done) return;
    const sh = cash / price;
    setShares(sh); setCash(0); setLong(true); setEntry(price);
    setTrades((t) => [...t, { step, type: "buy", price }]);
  }
  function sell() {
    if (!long || done) return;
    setCash(shares * price); setShares(0); setLong(false);
    setTrades((t) => [...t, { step, type: "sell", price }]);
  }
  function next() {
    if (done) return;
    const ns = step + 1;
    if (ns >= last) {
      // Final day: reveal it and settle at its close.
      const finalPrice = bars[last].c;
      const finalEquity = long ? shares * finalPrice : cash;
      setStep(last); setDone(true);
      const playerReturn = finalEquity / STAKE - 1;
      const buyHoldReturn = (bnhShares * finalPrice) / STAKE - 1;
      if (!submitted) { setSubmitted(true); onComplete(playerReturn, buyHoldReturn); }
    } else {
      setStep(ns);
    }
  }
  function replay() {
    setStep(0); setLong(false); setCash(STAKE); setShares(0); setEntry(0); setTrades([]); setDone(false); setSubmitted(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-8">
      <button onClick={onExit} className="pressable mb-4 rounded-full border border-hairline px-4 py-1.5 text-xs text-ink-3 hover:text-ink-1">← All scenarios</button>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="kicker mb-1">{scenario.symbol} · {scenario.era}</p>
          <h1 className="display text-2xl text-ink-1 md:text-3xl">{scenario.title}</h1>
        </div>
        <p className="tnum text-xs text-ink-4">Day {step + 1} / {bars.length}</p>
      </div>

      {!done && step === 0 && (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{scenario.setup}</p>
      )}

      <div className="mt-5"><ReplayChart bars={bars} step={step} trades={trades} /></div>

      {/* live scoreboard */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Price" value={usd(price)} />
        <Stat label="Your equity" value={usd(equity)} tone={playerReturn >= 0 ? "gain" : "loss"} sub={pctStr(playerReturn)} />
        <Stat label="Buy & hold" value={usd(bnhEquity)} tone={buyHoldReturn >= 0 ? "gain" : "loss"} sub={pctStr(buyHoldReturn)} />
        <Stat label="Position" value={long ? "Long" : "Cash"} sub={long ? `${usd(openPnl)} open` : "flat"} tone={long ? (openPnl >= 0 ? "gain" : "loss") : "ink-2"} />
      </div>

      {!done ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={buy} disabled={long}
            className="pressable rounded-xl border border-gain/50 bg-gain/10 py-3 text-sm font-semibold text-gain disabled:opacity-30">Buy</button>
          <button onClick={sell} disabled={!long}
            className="pressable rounded-xl border border-loss/50 bg-loss/10 py-3 text-sm font-semibold text-loss disabled:opacity-30">Sell</button>
          <button onClick={next}
            className="pressable cta-gold rounded-xl py-3 text-sm font-semibold">Next day →</button>
        </div>
      ) : (
        <Debrief scenario={scenario} playerReturn={playerReturn} buyHoldReturn={buyHoldReturn} onReplay={replay} onExit={onExit} />
      )}
    </main>
  );
}

function Debrief({ scenario, playerReturn, buyHoldReturn, onReplay, onExit }: {
  scenario: Scenario; playerReturn: number; buyHoldReturn: number; onReplay: () => void; onExit: () => void;
}) {
  const beat = playerReturn > buyHoldReturn + 1e-9;
  return (
    <div className="mt-6 card border-l-2 border-l-gold p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">How it really went</p>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <Stat label="You" value={pctStr(playerReturn)} tone={playerReturn >= 0 ? "gain" : "loss"} />
        <Stat label="Buy & hold" value={pctStr(buyHoldReturn)} tone={buyHoldReturn >= 0 ? "gain" : "loss"} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-1">
        {beat ? "You beat buy-and-hold — rare, and worth understanding why." : "Buy-and-hold came out ahead — as it usually does. Timing the market is brutally hard."}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{scenario.debrief}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={onReplay} className="pressable cta-gold rounded-full px-5 py-2.5 text-sm font-semibold">Replay it</button>
        <button onClick={onExit} className="pressable rounded-full border border-hairline px-5 py-2.5 text-sm text-ink-2 hover:text-ink-1">Another scenario</button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "ink-1" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 text-lg font-semibold text-${tone}`}>{value}</p>
      {sub && <p className={`tnum text-[11px] text-${tone === "ink-1" ? "ink-4" : tone}`}>{sub}</p>}
    </div>
  );
}

/* ---- candlestick chart that fills in as bars reveal ---- */
function ReplayChart({ bars, step, trades }: { bars: Bar[]; step: number; trades: Trade[] }) {
  const W = 680, H = 260, padX = 8, padTop = 12, padBot = 22;
  const shown = useMemo(() => bars.slice(0, step + 1), [bars, step]);
  const n = bars.length;
  const lo = Math.min(...shown.map((b) => b.l));
  const hi = Math.max(...shown.map((b) => b.h));
  const span = hi - lo || 1;
  const yPad = span * 0.08;
  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (W - 2 * padX);
  const y = (p: number) => padTop + (1 - (p - (lo - yPad)) / (span + 2 * yPad)) * (H - padTop - padBot);
  const bw = Math.max(1.5, ((W - 2 * padX) / n) * 0.6);

  return (
    <figure className="card overflow-hidden p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Price chart, ${shown.length} of ${n} days revealed. Latest close ${bars[step].c}.`}>
        {shown.map((b, i) => {
          const up = b.c >= b.o;
          const col = up ? "var(--gain)" : "var(--loss)";
          const cx = x(i);
          const yo = y(b.o), yc = y(b.c);
          const top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth="1" />
              <rect x={cx - bw / 2} y={top} width={bw} height={bh} fill={col} />
            </g>
          );
        })}
        {trades.map((t, i) => (
          <text key={i} x={x(t.step)} y={t.type === "buy" ? y(bars[t.step].l) + 14 : y(bars[t.step].h) - 6}
            textAnchor="middle" fontSize="11" fill={t.type === "buy" ? "var(--gain)" : "var(--loss)"}>
            {t.type === "buy" ? "▲" : "▼"}
          </text>
        ))}
      </svg>
    </figure>
  );
}
