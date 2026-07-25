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

  SCENE CONTRACT: this is a committed dark world in BOTH themes. Nothing here
  may key off flipping theme tokens (bg0/ink/hairline/glass) — every surface
  uses fixed dark constants, every hairline is white-at-low-opacity, and all
  copy uses .scene-ink tiers. Gold and gain/loss accents read on dark in both
  themes and are allowed through.

  Purely presentational. Pages own their form logic entirely.
*/

const EASE = [0.32, 0.72, 0, 1] as const;

/* Fixed dark ground — the scene's constant, independent of theme. */
const SCENE_BG = "oklch(0.13 0.02 280)";

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
      <span className="scene-ink-3 font-mono text-[10px] font-semibold uppercase tracking-[0.24em]">
        {props.label}
      </span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required
        className="scene-ink min-h-11 rounded-lg border border-white/10 px-3.5 py-3 text-base outline-none transition placeholder:text-[oklch(0.55_0.02_264)] focus:border-gold"
        style={{ background: "oklch(0.21 0.024 278 / 0.72)" }}
      />
      {props.hint && <span className="scene-ink-3 text-xs">{props.hint}</span>}
    </label>
  );
}

function TickerTape() {
  return (
    <div aria-hidden className="overflow-hidden border-t border-white/10 py-2.5"
      style={{ background: "oklch(0.13 0.02 280 / 0.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
      <div className="tape flex w-max gap-10 pl-6">
        {[...TAPE, ...TAPE].map(([sym, px, chg], i) => (
          <span key={i} className="tnum scene-ink-3 flex items-baseline gap-2 text-xs">
            <span className="scene-ink-2">{sym}</span>
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
    <div className="flex items-center justify-between gap-6 border-b border-white/10 py-2.5 font-mono text-[11px] tracking-[0.16em]">
      <span className="scene-ink-3 flex items-center gap-2">{icon}{k}</span>
      <span className={gold ? "text-gold" : "scene-ink-2"}>{v}</span>
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
    <main className="relative min-h-screen overflow-hidden" style={{ background: SCENE_BG }}>
      {/* ---------- Backdrop: the floor after hours ---------- */}
      <div aria-hidden className="absolute inset-0">
        {/* Dark fallback ground sits under the video while it loads. */}
        <div className="absolute inset-0" style={{ background: SCENE_BG }} />
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/main-search-video.mp4"
          autoPlay muted loop playsInline preload="metadata"
          style={{ filter: "brightness(0.55) saturate(0.85)" }}
        />
        {/* Legibility scrims — heavier over the form side, grounded at the base. */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to right, oklch(0.13 0.02 280 / 0.62) 0%, oklch(0.13 0.02 280 / 0.42) 45%, oklch(0.13 0.02 280 / 0.88) 100%)" }} />
        <div className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${SCENE_BG} 0%, transparent 34%), linear-gradient(to bottom, oklch(0.13 0.02 280 / 0.85) 0%, transparent 26%)` }} />
        {/* Terminal grid, barely there — white hairlines, constant in both themes. */}
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }} />
        {/* Scanlines. */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, oklch(1 0 0) 0px, oklch(1 0 0) 1px, transparent 1px, transparent 3px)" }} />
        {/* A low gold ember behind the panel side. */}
        <div className="absolute inset-y-0 right-0 w-2/3"
          style={{ background: "radial-gradient(52% 46% at 68% 52%, oklch(from var(--gold) l c h / 0.10), transparent 70%)" }} />
      </div>

      <div className="absolute right-4 top-4 z-30"><ThemeToggle /></div>

      {/* ---------- Stage ---------- */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row lg:items-stretch lg:gap-10">
        {/* Scene side — brand moment + desk readouts */}
        <section className="flex flex-col px-4 pt-6 sm:px-6 sm:pt-8 lg:flex-1 lg:justify-between lg:px-10 lg:pb-24 lg:pt-10">
          <motion.div {...enter(0)}>
            {/* The wordmark sits over the dark scene; force its lettering to
                scene ink so it survives light mode (component stays untouched). */}
            <Link href="/" className="pressable inline-flex [&_span]:text-[oklch(0.96_0.008_264)]">
              <TarsWordmark size={28} text="TARS TRADING" animate />
            </Link>
          </motion.div>

          <motion.div {...enter(0.15)} className="hidden max-w-md lg:block">
            <p className="kicker mb-5">{sceneKicker}</p>
            <h2 className="display scene-ink text-5xl leading-[0.98] xl:text-6xl">
              {sceneHeading}
            </h2>
            <p className="scene-ink-2 mt-5 text-base leading-relaxed">{sceneCopy}</p>

            <div className="mt-10 border-t border-white/10">
              <Readout k="MODE" v="SIMULATED" gold
                icon={<Icon.Shield className="h-3.5 w-3.5 text-gold" />} />
              <Readout k="MARKETS" v="US EQUITIES · CRYPTO"
                icon={<Icon.Candles className="h-3.5 w-3.5" />} />
              <Readout k="DATA" v="REAL PRICES, LIVE"
                icon={<Icon.Chart className="h-3.5 w-3.5" />} />
            </div>
          </motion.div>
        </section>

        {/* Form side — the glass panel (fixed dark glass; never theme glass) */}
        <section className="flex flex-1 items-center justify-center px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pb-28 lg:pt-10">
          <motion.div
            {...(reduced
              ? { initial: false as const }
              : {
                  initial: { opacity: 0, y: 28, scale: 0.985 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  transition: { delay: 0.1, duration: 0.8, ease: EASE },
                })}
            className="relative w-full max-w-md border border-white/10 p-6 sm:p-7 md:p-8"
            style={{
              borderRadius: "var(--r-l)",
              borderTopColor: "oklch(from var(--gold) l c h / 0.45)",
              background: "oklch(0.16 0.02 280 / 0.66)",
              backdropFilter: "blur(22px) saturate(1.35)",
              WebkitBackdropFilter: "blur(22px) saturate(1.35)",
              boxShadow: "0 32px 90px -36px oklch(0 0 0 / 0.65), 0 1px 0 oklch(1 0 0 / 0.06) inset",
            }}
          >
            <MicroLabel dot>{micro}</MicroLabel>
            <h1 className="display scene-ink mt-4 text-3xl md:text-[2.1rem]">{title}</h1>
            {subtitle && <p className="scene-ink-2 mt-2.5 text-sm leading-relaxed">{subtitle}</p>}

            <div className="mt-6">{children}</div>

            {/* The honesty line — a hard product requirement, worn like a hallmark. */}
            <div className="mt-6 flex items-start gap-2.5 border-t border-white/10 pt-4">
              <Icon.Shield className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="scene-ink-3 text-xs leading-relaxed">
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
