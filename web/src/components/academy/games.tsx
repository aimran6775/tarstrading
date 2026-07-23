"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/*
  Micro-games — a lesson lands harder when you had to DECIDE. Each is one
  round, instant feedback, honest explanation. They drill the exact skill the
  lesson just taught: size a trade, read structure, find a level, match an
  order to its job.
*/

/** Fire-and-forget: log a drill attempt for the admin's drill analytics. */
function logGame(variant: string, correct: boolean) {
  fetch("/api/academy/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant, correct }),
  }).catch(() => { /* analytics are best-effort */ });
}

export default function LessonGame({ variant, title }: {
  variant: "size-it" | "bull-or-bear" | "spot-the-level" | "order-match";
  title?: string;
}) {
  const report = (correct: boolean) => logGame(variant, correct);
  return (
    <div className="card p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-agent">
        <span>▲</span> {title ?? "Your turn"}
      </p>
      {variant === "size-it" && <SizeIt onResult={report} />}
      {variant === "bull-or-bear" && <ReadStructure onResult={report} />}
      {variant === "spot-the-level" && <SpotLevel onResult={report} />}
      {variant === "order-match" && <OrderMatch onResult={report} />}
    </div>
  );
}

function Verdict({ right, text, onNext }: { right: boolean; text: string; onNext?: () => void }) {
  const rm = useReducedMotion();
  return (
    <motion.div initial={rm ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} aria-live="polite"
      className={`mt-3 rounded-lg border px-4 py-3 text-sm leading-relaxed ${
        right ? "border-gain/40 bg-gain/10 text-ink-1" : "border-loss/40 bg-loss/10 text-ink-1"
      }`}>
      <span className={right ? "font-semibold text-gain" : "font-semibold text-loss"}>{right ? "Correct. " : "Not quite. "}</span>
      {text}
      {onNext && (
        <button onClick={onNext} className="pressable ml-2 text-xs text-gold hover:underline">Another →</button>
      )}
    </motion.div>
  );
}

/* ---------- Size it ---------- */
function SizeIt({ onResult }: { onResult: (correct: boolean) => void }) {
  const rounds = useMemo(() => [
    { account: 100_000, risk: 1, entry: 50, stop: 48, answer: 500 },
    { account: 50_000, risk: 2, entry: 200, stop: 195, answer: 200 },
    { account: 100_000, risk: 1, entry: 25, stop: 24, answer: 1000 },
  ], []);
  const [r, setR] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const round = rounds[r % rounds.length];
  const correct = round.answer;
  const options = useMemo(() => {
    const o = new Set<number>([correct, correct * 2, Math.round(correct / 2), Math.round(correct * 1.5)]);
    return [...o].slice(0, 4).sort(() => 0.5 - ((r * 7) % 3) / 2); // deterministic-ish shuffle
  }, [correct, r]);

  return (
    <div>
      <p className="text-sm text-ink-2">
        Account <span className="tnum text-ink-1">${round.account.toLocaleString()}</span>, risking{" "}
        <span className="text-loss">{round.risk}%</span>. Entry{" "}
        <span className="tnum text-ink-1">${round.entry}</span>, stop{" "}
        <span className="tnum text-ink-1">${round.stop}</span>. <strong className="text-ink-1">How many shares?</strong>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((o) => {
          const isAns = o === correct, isPicked = o === picked;
          return (
            <button key={o} disabled={picked !== null} onClick={() => { setPicked(o); onResult(o === correct); }}
              className={`pressable tnum rounded-lg border px-4 py-3 text-sm font-semibold ${
                picked === null ? "border-hairline text-ink-1 hover:border-ink-4"
                : isAns ? "border-gain/60 bg-gain/10 text-gain"
                : isPicked ? "border-loss/60 bg-loss/10 text-loss" : "border-hairline text-ink-4"
              }`}>
              {o.toLocaleString()} shares
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <Verdict right={picked === correct}
          text={`Risk $ = ${round.account.toLocaleString()} × ${round.risk}% = $${(round.account * round.risk / 100).toLocaleString()}. Per-share risk = $${round.entry} − $${round.stop} = $${round.entry - round.stop}. Shares = risk ÷ per-share = ${correct.toLocaleString()}.`}
          onNext={() => { setR((x) => x + 1); setPicked(null); }} />
      )}
    </div>
  );
}

/* ---------- Read the structure ---------- */
function ReadStructure({ onResult }: { onResult: (correct: boolean) => void }) {
  const rm = useReducedMotion();
  const rounds = useMemo(() => [
    { data: [30, 40, 35, 50, 44, 60, 54, 72], answer: "up" },
    { data: [72, 58, 64, 46, 52, 34, 40, 24], answer: "down" },
    { data: [42, 60, 43, 59, 44, 60, 42, 58], answer: "range" },
  ] as const, []);
  const [r, setR] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const round = rounds[r % rounds.length];
  const W = 240, H = 80;
  const x = (i: number) => 6 + (i / (round.data.length - 1)) * (W - 12);
  const y = (v: number) => H - 6 - ((v - 20) / 60) * (H - 12);
  const path = round.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">Reading the past — what structure is this?</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full rounded-lg bg-bg2">
        <motion.polyline key={r} points={path} fill="none" stroke="var(--ink-2)" strokeWidth="2"
          initial={rm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: rm ? 0 : 0.7 }} />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["up", "down", "range"] as const).map((k) => {
          const isAns = k === round.answer, isPicked = k === picked;
          return (
            <button key={k} disabled={picked !== null} onClick={() => { setPicked(k); onResult(k === round.answer); }}
              className={`pressable rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${
                picked === null ? "border-hairline text-ink-1 hover:border-ink-4"
                : isAns ? "border-gain/60 bg-gain/10 text-gain"
                : isPicked ? "border-loss/60 bg-loss/10 text-loss" : "border-hairline text-ink-4"
              }`}>
              {k === "up" ? "Uptrend" : k === "down" ? "Downtrend" : "Range"}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <Verdict right={picked === round.answer}
          text={round.answer === "up" ? "Higher highs, higher lows — buyers in control." : round.answer === "down" ? "Lower highs, lower lows — sellers in control." : "Same ceiling, same floor — nobody's winning. This is a range."}
          onNext={() => { setR((x) => x + 1); setPicked(null); }} />
      )}
    </div>
  );
}

/* ---------- Spot the level ---------- */
function SpotLevel({ onResult }: { onResult: (correct: boolean) => void }) {
  // Tap (or arrow-key) where support sits (~value 45). Reveal after committing.
  const data = [50, 44, 62, 45, 64, 44, 60, 46, 63];
  const W = 260, H = 120, min = 40, max = 70;
  const x = (i: number) => 10 + (i / (data.length - 1)) * (W - 20);
  const y = (v: number) => H - 12 - ((v - min) / (max - min)) * (H - 24);
  const supportY = y(45);
  const rm = useReducedMotion();
  const [cursorY, setCursorY] = useState(H / 2);
  const [committed, setCommitted] = useState(false);
  const path = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const close = Math.abs(cursorY - supportY) < 20; // forgiving on touch

  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">
        Point at where <span className="text-gain">support</span> is — the floor price keeps bouncing off.
        Tap the chart, or focus it and use <span className="text-ink-1">↑ ↓</span> then <span className="text-ink-1">Enter</span>.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full rounded-lg bg-bg2 cursor-crosshair"
        role="slider" tabIndex={0}
        aria-label="Guess the support price level: use up and down arrows, then Enter to commit"
        aria-valuemin={0} aria-valuemax={H} aria-valuenow={Math.round(cursorY)}
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const y = ((e.clientY - r.top) / r.height) * H;
          setCursorY(y);
          setCommitted(true);
          onResult(Math.abs(y - supportY) < 20);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); setCommitted(false); setCursorY((v) => Math.max(6, v - 4)); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setCommitted(false); setCursorY((v) => Math.min(H - 6, v + 4)); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCommitted(true); onResult(close); }
        }}>
        <polyline points={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.8" />
        {!committed && (
          <line x1="10" x2={W - 10} y1={cursorY} y2={cursorY} stroke="var(--ink-4)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
        )}
        {committed && (
          <>
            <line x1="10" x2={W - 10} y1={cursorY} y2={cursorY} stroke={close ? "var(--gain)" : "var(--loss)"} strokeWidth="1.5" strokeDasharray="4 3" />
            <motion.line x1="10" x2={W - 10} y1={supportY} y2={supportY} stroke="var(--gain)" strokeWidth="1.5"
              initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} />
          </>
        )}
      </svg>
      {committed && (
        <Verdict right={close}
          text={close ? "That's the level — price tested it three times and held each time. Buyers defend it." : "Look for the price where the line bottomed out again and again — that repeated floor is support (the solid green line)."}
          onNext={() => { setCommitted(false); setCursorY(H / 2); }} />
      )}
    </div>
  );
}

/* ---------- Order match ---------- */
function OrderMatch({ onResult }: { onResult: (correct: boolean) => void }) {
  const jobs = useMemo(() => [
    { q: "Buy right now, whatever the price.", answer: "Market", why: "A market order fills immediately at the best available price — speed over price." },
    { q: "Only buy if it dips to $95.", answer: "Limit", why: "A limit order sets your price and waits — price over speed. It may never fill." },
    { q: "Sell automatically if it falls to $90 to cap my loss.", answer: "Stop", why: "A stop order triggers once price hits your level, then fills like a market order. Your safety net." },
  ], []);
  const [r, setR] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const job = jobs[r % jobs.length];
  return (
    <div>
      <p className="text-sm text-ink-2">Which order does this job? <span className="text-ink-1">&ldquo;{job.q}&rdquo;</span></p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Market", "Limit", "Stop"].map((o) => {
          const isAns = o === job.answer, isPicked = o === picked;
          return (
            <button key={o} disabled={picked !== null} onClick={() => { setPicked(o); onResult(o === job.answer); }}
              className={`pressable rounded-lg border px-3 py-2 text-xs font-semibold ${
                picked === null ? "border-hairline text-ink-1 hover:border-ink-4"
                : isAns ? "border-gain/60 bg-gain/10 text-gain"
                : isPicked ? "border-loss/60 bg-loss/10 text-loss" : "border-hairline text-ink-4"
              }`}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <Verdict right={picked === job.answer} text={job.why}
          onNext={() => { setR((x) => x + 1); setPicked(null); }} />
      )}
    </div>
  );
}
