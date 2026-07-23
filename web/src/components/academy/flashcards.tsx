"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/*
  A flip-card deck for the terms a lesson introduced. Tap to flip, rate
  yourself "got it" / "again"; the "again" pile loops back until the deck is
  clean. Low-stakes recall — the thing that actually moves knowledge into
  long-term memory.
*/

type Card = { front: string; back: string };

export default function Flashcards({ title, cards }: { title?: string; cards: Card[] }) {
  const [queue, setQueue] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [got, setGot] = useState<Set<number>>(new Set());

  const done = pos >= queue.length;
  const current = queue[pos];
  const total = cards.length;
  const learned = got.size;

  function rate(keep: boolean) {
    const next = keep ? queue : [...queue, current];
    if (keep) setGot((g) => new Set(g).add(current));
    setQueue(next);
    setFlipped(false);
    setPos((p) => p + 1);
  }
  function restart() {
    setQueue(cards.map((_, i) => i)); setPos(0); setFlipped(false); setGot(new Set());
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">{title ?? "Flashcards"}</p>
        <p className="tnum text-[11px] text-ink-4">{learned} / {total} learned</p>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-semibold text-gain">Deck clean. Nice recall.</p>
          <button onClick={restart} className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-2 hover:text-ink-1">
            Run it again
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => setFlipped((f) => !f)}
            className="pressable relative block h-40 w-full [perspective:1200px]" aria-label="Flip card">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${current}-${flipped}`}
                initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className={`absolute inset-0 flex items-center justify-center rounded-xl border p-6 text-center ${
                  flipped ? "border-gold/40 bg-gold/8" : "border-hairline bg-bg2"
                }`}>
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.2em] ${flipped ? "text-gold" : "text-ink-4"}`}>
                    {flipped ? "Definition" : "Term"}
                  </p>
                  <p className={`mt-2 leading-relaxed ${flipped ? "text-sm text-ink-2" : "text-lg font-semibold text-ink-1"}`}>
                    {flipped ? cards[current].back : cards[current].front}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </button>

          <div className="mt-3 flex items-center justify-between">
            <p className="tnum text-[11px] text-ink-4">{pos + 1} of {queue.length}</p>
            {flipped ? (
              <div className="flex gap-2">
                <button onClick={() => rate(false)} className="pressable rounded-full border border-hairline px-4 py-1.5 text-xs text-ink-3 hover:text-loss">
                  Again
                </button>
                <button onClick={() => rate(true)} className="pressable rounded-full bg-gain/15 px-4 py-1.5 text-xs font-semibold text-gain">
                  Got it
                </button>
              </div>
            ) : (
              <button onClick={() => setFlipped(true)} className="pressable rounded-full border border-hairline px-4 py-1.5 text-xs text-ink-2 hover:text-ink-1">
                Reveal
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
