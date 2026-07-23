"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import ThemeToggle from "./theme-toggle";
import TarsWordmark from "./tars-wordmark";

const OrbitalMarket = dynamic(() => import("./orbital-market"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(42% 42% at 50% 46%, oklch(from var(--gold) l c h / 0.16), transparent 70%)",
      }}
    />
  ),
});

/* Deterministic sample tape — moves like the floor, costs nothing. */
const TAPE = [
  ["AAPL", "+1.43"], ["NVDA", "-0.12"], ["TSLA", "+2.09"], ["SPY", "+0.27"],
  ["BTC", "+1.99"], ["ETH", "+1.30"], ["MSFT", "+0.64"], ["AMZN", "-0.38"],
  ["META", "+0.91"], ["GOOG", "+0.22"], ["AMD", "-1.05"], ["NFLX", "+0.47"],
] as const;

const revealMotion = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] as const },
};

export default function Landing() {
  const reduced = useReducedMotion();
  return (
    <main className="flex min-h-screen flex-col">
      <header className="glass fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-3 md:px-10">
        <TarsWordmark size={26} animate />

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="pressable rounded-full px-4 py-2 text-sm text-ink-2 hover:text-ink-1">
            Log in
          </Link>
          <Link href="/join" className="pressable cta-gold rounded-full px-5 py-2 text-sm font-semibold">
            Start with $100k
          </Link>
        </nav>
      </header>

      {/* ---------- HERO: the market you can hold ---------- */}
      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
        <OrbitalMarket />

        {/* Legibility scrim over the canvas floor */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: "linear-gradient(to top, var(--bg0) 12%, transparent)" }} />

        <div className="relative z-10 px-5 pb-16 pt-28 md:px-10 md:pb-20">
          <motion.p
            initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.9 }}
            className="kicker mb-5"
          >
            A flight simulator for markets
          </motion.p>
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
            className="display max-w-5xl text-[clamp(2.6rem,9.5vw,7.5rem)] leading-[0.97] text-ink-1"
          >
            Learn to trade
            <br />
            <span className="text-gold">before you trade.</span>
          </motion.h1>
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2"
          >
            Tars hands you <span className="tnum text-ink-1">$100,000</span>{" "}in simulated
            capital, real market data, an academy that starts at zero, and an
            assistant that hires analysts to trade your ideas. Every fill is
            practice. That&apos;s the point.
          </motion.p>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link href="/join" className="pressable cta-gold rounded-full px-8 py-4 text-base font-semibold">
              Start with $100,000
            </Link>
            <a href="#terminal" className="pressable rounded-full border border-hairline px-8 py-4 text-base text-ink-2 hover:border-ink-4 hover:text-ink-1">
              See the terminal
            </a>
          </motion.div>
        </div>

        {/* The tape */}
        <div className="relative z-10 overflow-hidden border-t border-hairline py-3">
          <div className="tape flex w-max gap-10 pl-6">
            {[...TAPE, ...TAPE].map(([sym, chg], i) => (
              <span key={i} className="tnum flex items-baseline gap-2 text-xs text-ink-3">
                <span className="text-ink-2">{sym}</span>
                <span className={chg.startsWith("+") ? "text-gain" : "text-loss"}>{chg}%</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SCENE 1: The terminal ---------- */}
      <section id="terminal" className="mx-auto w-full max-w-6xl px-5 py-28 md:px-10 md:py-40">
        <motion.div {...(reduced ? { initial: false } : revealMotion)}>
          <p className="kicker mb-4">01 · The terminal</p>
          <h2 className="display max-w-3xl text-4xl text-ink-1 md:text-6xl">
            Real prices. Honest fills.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            Live market data, limit and stop orders, slippage that behaves like
            slippage. When your quote is stale, the terminal says so. When the
            market is closed, it tells you when it opens.
          </p>
        </motion.div>

        <motion.div {...(reduced ? { initial: false } : revealMotion)} className="card mt-12 overflow-hidden"
          style={{ transformPerspective: 1200 }}>
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <span className="tnum text-xs text-ink-3">AAPL · Apple Inc.</span>
            <span className="sim-mark">SIMULATED</span>
          </div>
          <div className="grid gap-0 md:grid-cols-[1fr_280px]">
            <MiniChart />
            <div className="flex flex-col justify-between border-t border-hairline p-5 md:border-l md:border-t-0">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-3">Last</p>
                <p className="tnum mt-1 text-3xl font-semibold text-ink-1">327.74</p>
                <p className="tnum text-sm text-gain">+1.43%</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <span className="pressable rounded-lg bg-gain/15 py-2.5 text-center text-sm font-semibold text-gain">Buy</span>
                <span className="pressable rounded-lg bg-loss/15 py-2.5 text-center text-sm font-semibold text-loss">Sell</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- SCENE 2: The academy ---------- */}
      <section className="border-t border-hairline">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-28 md:grid-cols-2 md:px-10 md:py-40">
          <motion.div {...(reduced ? { initial: false } : revealMotion)}>
            <p className="kicker mb-4">02 · The academy</p>
            <h2 className="display text-4xl text-ink-1 md:text-6xl">
              Zero to Greeks.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-2">
              Six tracks, from what a candlestick is to how options breathe.
              Tars teaches in plain language, quizzes you, and keeps score in
              XP — never in dollars you don&apos;t have yet.
            </p>
          </motion.div>
          <motion.div {...(reduced ? { initial: false } : revealMotion)} className="flex flex-col gap-3">
            {[
              ["Foundations", "What a market actually is", 100],
              ["Reading price", "Candles, volume, structure", 64],
              ["Risk", "Position sizing before conviction", 27],
              ["Options", "The Greeks, without the mysticism", 0],
            ].map(([title, sub, pct]) => (
              <div key={title as string} className="card flex items-center gap-4 p-4">
                <div className="relative h-10 w-10 shrink-0">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                    <circle cx="20" cy="20" r="17" fill="none" stroke="var(--bg3)" strokeWidth="3" />
                    <circle cx="20" cy="20" r="17" fill="none" stroke="var(--gold)" strokeWidth="3"
                      strokeDasharray={`${(Number(pct) / 100) * 106.8} 106.8`} strokeLinecap="round" />
                  </svg>
                  <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] text-ink-2">
                    {pct as number}%
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-1">{title}</p>
                  <p className="text-xs text-ink-3">{sub}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- SCENE 3: Agents ---------- */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-6xl px-5 py-28 md:px-10 md:py-40">
          <motion.div {...(reduced ? { initial: false } : revealMotion)}>
            <p className="kicker mb-4">03 · The assistant</p>
            <h2 className="display max-w-3xl text-4xl text-ink-1 md:text-6xl">
              Just say it.
              <br />
              <span className="text-agent">It hires the analyst.</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
              Describe a strategy in plain English. Your assistant compiles it
              into transparent rules, backtests it honestly on data it&apos;s never
              seen, deploys it on your word, and narrates every decision. The
              kill switch is always yours.
            </p>
          </motion.div>

          <motion.div {...(reduced ? { initial: false } : revealMotion)} className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              ["Golden Cross", "🥇", "Buys strength, exits weakness. In-sample 71% — out-of-sample 58%. It tells you both.", "running"],
              ["Mean Reverter", "🧲", "Fades panic. Halted itself after a 12% drawdown, exactly as programmed.", "halted"],
              ["Your next idea", "✳️", "IF rsi(14) < 30 AND price > sma(200) THEN buy. You write it, it obeys.", "draft"],
            ].map(([name, emoji, body, status]) => (
              <div key={name as string} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{emoji}</span>
                  <span className={`tnum text-[10px] uppercase tracking-[0.2em] ${
                    status === "running" ? "text-agent" : status === "halted" ? "text-loss" : "text-ink-3"
                  }`}>
                    {status as string}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink-1">{name}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-28 text-center md:py-40">
          <motion.p {...(reduced ? { initial: false } : revealMotion)} className="kicker mb-6">Your opening balance</motion.p>
          <motion.p {...(reduced ? { initial: false } : revealMotion)} className="display tnum text-6xl text-ink-1 md:text-8xl">
            $100,000
          </motion.p>
          <motion.p {...(reduced ? { initial: false } : revealMotion)} className="mt-4 max-w-md text-base text-ink-2">
            Simulated capital. Real market data. Real skill — the only thing
            here that transfers to the real world.
          </motion.p>
          <motion.div {...(reduced ? { initial: false } : revealMotion)} className="mt-10">
            <Link href="/join" className="pressable cta-gold rounded-full px-10 py-4 text-base font-semibold">
              Open your account
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-hairline px-5 py-10 md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <TarsWordmark size={26} text="TARS TRADING" />
          <p className="max-w-xl text-xs leading-relaxed text-ink-4">
            Tars Trading is an educational simulator. All capital is simulated; no
            real money, brokerage services, or investment advice. Simulated results
            never promise real ones.
          </p>
        </div>
      </footer>
    </main>
  );
}

/** Tiny deterministic candle chart for the terminal scene. Pure SVG. */
function MiniChart() {
  // Rounded to 2dp so SSR and client hydrate to identical attribute strings.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const candles = Array.from({ length: 42 }, (_, i) => {
    const s = Math.sin(i * 0.4) * 14 + Math.sin(i * 1.7) * 6;
    const drift = i * 0.9;
    const open = r2(90 - s - drift * 0.4);
    const close = r2(open - (Math.sin(i * 2.3) * 9 + 2));
    return { open, close, hi: r2(Math.min(open, close) - 4), lo: r2(Math.max(open, close) + 5) };
  });
  return (
    <svg viewBox="0 0 420 180" className="h-56 w-full md:h-72" preserveAspectRatio="none" aria-hidden>
      {candles.map((c, i) => {
        const x = r2(8 + i * 9.7);
        const up = c.close < c.open;
        const color = up ? "var(--gain)" : "var(--loss)";
        return (
          <g key={i}>
            <line x1={x + 2} x2={x + 2} y1={c.hi + 60} y2={c.lo + 60} stroke={color} strokeWidth="1" opacity="0.8" />
            <rect x={x} width="4.4"
              y={Math.min(c.open, c.close) + 60}
              height={Math.max(2, Math.abs(c.close - c.open))}
              fill={color} rx="1" />
          </g>
        );
      })}
    </svg>
  );
}
