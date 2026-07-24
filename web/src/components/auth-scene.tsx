"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import ThemeToggle from "@/components/theme-toggle";
import TarsWordmark from "@/components/tars-wordmark";
import { Icon } from "@/components/icons";

/*
  AuthScene — the shared stage for /login and /join.

  The composition: the trading floor after hours. A darkened market video
  breathes behind everything; a grid + scanline pass at whisper opacity gives
  it terminal texture; a ticker runs along the floor. The scene side (left,
  desktop only) carries the brand moment and desk readouts; the form lives in
  a glass panel with a gold-lit top edge — the keys to the terminal.

  Purely presentational. Pages own their form logic entirely.
*/

const EASE = [0.32, 0.72, 0, 1] as const;

/* Deterministic decorative tape — plausible prices, zero network cost. */
const TAPE = [
  ["AAPL", "231.44", "+1.43"],
  ["NVDA", "188.02", "-0.12"],
  ["MSFT", "512.30", "+0.64"],
  ["BTC/USD", "118,240", "+1.99"],
  ["TSLA", "329.65", "+2.09"],
  ["SPY", "637.18", "+0.27"],
  ["ETH/USD", "3,812", "+1.30"],
  ["AMZN", "226.13", "-0.38"],
  ["META", "718.94", "+0.91"],
  ["GOOG", "185.06", "+0.22"],
  ["AMD", "158.71", "-1.05"],
  ["NFLX", "1,241.35", "+0.47"],
] as const;

/** Monospace micro-label — the terminal's way of naming a section. */
export function MicroLabel({ children, dot = false }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
      {dot && (
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-gold"
          style={{ boxShadow: "0 0 8px 1px oklch(from var(--gold) l c h / 0.7)" }} />
      )}
      {children}
    </p>
  );
}

/** Shared input field — identical behavior to the old inline inputs. */
export function AuthField(props: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-3">
        {props.label}
      </span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required
        className="rounded-lg border border-hairline px-3.5 py-3 text-ink-1 outline-none transition focus:border-gold"
        style={{ background: "oklch(from var(--bg1) l c h / 0.72)" }}
      />
      {props.hint && <span className="text-xs text-ink-4">{props.hint}</span>}
    </label>
  );
}

function TickerTape() {
  return (
    <div aria-hidden className="overflow-hidden border-t border-hairline py-2.5"
      style={{ background: "oklch(from var(--bg0) l c h / 0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
      <div className="tape flex w-max gap-10 pl-6">
        {[...TAPE, ...TAPE].map(([sym, px, chg], i) => (
          <span key={i} className="tnum flex items-baseline gap-2 text-xs text-ink-3">
            <span className="text-ink-2">{sym}</span>
            <span>{px}</span>
            <span className={chg.startsWith("+") ? "text-gain" : "text-loss"}>{chg}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Readout({ k, v, gold = false, icon }: {
  k: string; v: string; gold?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-hairline py-2.5 font-mono text-[11px] tracking-[0.16em]">
      <span className="flex items-center gap-2 text-ink-4">{icon}{k}</span>
      <span className={gold ? "text-gold" : "text-ink-2"}>{v}</span>
    </div>
  );
}

export default function AuthScene({
  micro, title, subtitle, sceneKicker, sceneHeading, sceneCopy, children,
}: {
  /** Monospace access label inside the panel, e.g. "AUTHENTICATED ACCESS". */
  micro: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Kicker above the scene-side headline (desktop only). */
  sceneKicker: string;
  sceneHeading: React.ReactNode;
  sceneCopy: string;
  /** The form. Logic stays entirely in the page. */
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const enter = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.7, ease: EASE },
        };

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg0">
      {/* ---------- Backdrop: the floor after hours ---------- */}
      <div aria-hidden className="absolute inset-0">
        {/* Dark fallback ground sits under the video while it loads. */}
        <div className="absolute inset-0 bg-bg0" />
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/main-search-video.mp4"
          autoPlay muted loop playsInline preload="metadata"
          style={{ filter: "brightness(0.55) saturate(0.85)" }}
        />
        {/* Legibility scrims — heavier over the form side, grounded at the base. */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to right, oklch(from var(--bg0) l c h / 0.62) 0%, oklch(from var(--bg0) l c h / 0.42) 45%, oklch(from var(--bg0) l c h / 0.88) 100%)" }} />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--bg0) 0%, transparent 34%), linear-gradient(to bottom, oklch(from var(--bg0) l c h / 0.85) 0%, transparent 26%)" }} />
        {/* Terminal grid, barely there. */}
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(var(--ink-3) 1px, transparent 1px), linear-gradient(90deg, var(--ink-3) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }} />
        {/* Scanlines. */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, var(--ink-1) 0px, var(--ink-1) 1px, transparent 1px, transparent 3px)" }} />
        {/* A low gold ember behind the panel side. */}
        <div className="absolute inset-y-0 right-0 w-2/3"
          style={{ background: "radial-gradient(52% 46% at 68% 52%, oklch(from var(--gold) l c h / 0.10), transparent 70%)" }} />
      </div>

      <div className="absolute right-4 top-4 z-30"><ThemeToggle /></div>

      {/* ---------- Stage ---------- */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row lg:items-stretch lg:gap-10">
        {/* Scene side — brand moment + desk readouts */}
        <section className="flex flex-col px-6 pt-8 lg:flex-1 lg:justify-between lg:px-10 lg:pb-24 lg:pt-10">
          <motion.div {...enter(0)}>
            <Link href="/" className="pressable inline-flex">
              <TarsWordmark size={28} text="TARS TRADING" animate />
            </Link>
          </motion.div>

          <motion.div {...enter(0.15)} className="hidden max-w-md lg:block">
            <p className="kicker mb-5">{sceneKicker}</p>
            <h2 className="display text-5xl leading-[0.98] text-ink-1 xl:text-6xl">
              {sceneHeading}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-2">{sceneCopy}</p>

            <div className="mt-10 border-t border-hairline">
              <Readout k="MODE" v="SIMULATED" gold
                icon={<Icon.Shield className="h-3.5 w-3.5 text-gold" />} />
              <Readout k="MARKETS" v="US EQUITIES · CRYPTO"
                icon={<Icon.Candles className="h-3.5 w-3.5" />} />
              <Readout k="DATA" v="REAL PRICES, LIVE"
                icon={<Icon.Chart className="h-3.5 w-3.5" />} />
            </div>
          </motion.div>
        </section>

        {/* Form side — the glass panel */}
        <section className="flex flex-1 items-center justify-center px-6 pb-24 pt-10 lg:px-10 lg:pb-28">
          <motion.div
            {...(reduced
              ? { initial: false as const }
              : {
                  initial: { opacity: 0, y: 28, scale: 0.985 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  transition: { delay: 0.1, duration: 0.8, ease: EASE },
                })}
            className="relative w-full max-w-md border border-hairline p-7 md:p-8"
            style={{
              borderRadius: "var(--r-l)",
              borderTopColor: "oklch(from var(--gold) l c h / 0.45)",
              background: "var(--glass)",
              backdropFilter: "blur(22px) saturate(1.35)",
              WebkitBackdropFilter: "blur(22px) saturate(1.35)",
              boxShadow: "0 32px 90px -36px oklch(0 0 0 / 0.65), 0 1px 0 oklch(1 0 0 / 0.06) inset",
            }}
          >
            <MicroLabel dot>{micro}</MicroLabel>
            <h1 className="display mt-4 text-3xl text-ink-1 md:text-[2.1rem]">{title}</h1>
            {subtitle && <p className="mt-2.5 text-sm leading-relaxed text-ink-2">{subtitle}</p>}

            <div className="mt-6">{children}</div>

            {/* The honesty line — a hard product requirement, worn like a hallmark. */}
            <div className="mt-6 flex items-start gap-2.5 border-t border-hairline pt-4">
              <Icon.Shield className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-xs leading-relaxed text-ink-3">
                All capital here is simulated — paper trading only. Real market
                data, real practice, zero real money at risk.
              </p>
            </div>
          </motion.div>
        </section>
      </div>

      {/* The tape runs along the floor. */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <TickerTape />
      </div>
    </main>
  );
}
