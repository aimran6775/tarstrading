"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/*
  The first-run tour — a five-card welcome the very first time someone lands on
  the Floor. Next moves forward, Skip leaves at any point, and once it's seen
  (localStorage) it never shows again. Purely orienting; it changes nothing.
*/

const KEY = "tars-tour-seen";

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: "👋",
    title: "Welcome to your Trading Floor",
    body: "This is home base. Your equity, your book, your learning, and your analysts — all on one screen. It's the first thing you'll see every time you log in.",
  },
  {
    icon: "💹",
    title: "The desk",
    body: "Trade US stocks and crypto with $100,000 in simulated money. Real prices, real mechanics, zero real risk. Size every trade from a stop and you're already ahead of most.",
  },
  {
    icon: "🎓",
    title: "The academy",
    body: "Eleven interactive stages, from “what is a market” to running a book — with an AI tutor on every lesson, missions you prove with real trades, and famous crashes to replay.",
  },
  {
    icon: "🤖",
    title: "Your assistant",
    body: "Describe a strategy in plain English and it hires an analyst to run it for you, around the clock. You stay in control — a kill switch is always one tap away.",
  },
  {
    icon: "🚀",
    title: "You're set",
    body: "Everything here is simulated, so explore freely and make mistakes on purpose. That's how you learn to trade without it costing you.",
  },
];

export default function FloorTour({ hasAgents }: { hasAgents?: boolean }) {
  void hasAgents;
  const rm = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setTimeout(() => setOpen(true), 450); } catch { /* no storage, no tour */ }
  }, []);

  function close() {
    try { localStorage.setItem(KEY, "1"); } catch { /* fine */ }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-bg0/70 backdrop-blur-sm" onClick={close} aria-hidden />
        <motion.div role="dialog" aria-modal="true" aria-label="Welcome tour"
          initial={rm ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: rm ? 0 : 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="glass relative w-full max-w-md overflow-hidden rounded-3xl border border-hairline p-7 shadow-2xl">
          <div className="text-4xl" aria-hidden>{step.icon}</div>
          <h2 className="mt-4 font-display text-xl font-bold text-ink-1">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              {STEPS.map((_, k) => (
                <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-gold" : "w-1.5 bg-bg3"}`} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!last && <button onClick={close} className="pressable rounded-full px-3 py-2 text-xs text-ink-4 hover:text-ink-2">Skip</button>}
              <button autoFocus onClick={() => (last ? close() : setI((n) => n + 1))}
                className="pressable cta-gold rounded-full px-5 py-2 text-sm font-semibold">
                {last ? "Start trading" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
