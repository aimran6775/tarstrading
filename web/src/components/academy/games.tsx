"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

/*
  Micro-games — a lesson lands harder when you had to DECIDE. Each is one
  round, instant feedback, honest explanation. They drill the exact skill the
  lesson just taught: size a trade, read structure, find a level, match an
  order to its job.
*/

export default function LessonGame({ variant, title }: {
  variant: "size-it" | "bull-or-bear" | "spot-the-level" | "order-match";
  title?: string;
}) {
  return (
    <div className="card p-5">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-agent">
        <span>▲</span> {title ?? "Your turn"}
      </p>
      {variant === "size-it" && <SizeIt />}
      {variant === "bull-or-bear" && <ReadStructure />}
      {variant === "spot-the-level" && <SpotLevel />}
      {variant === "order-match" && <OrderMatch />}
    </div>
  );
}

function Verdict({ right, text, onNext }: { right: boolean; text: string; onNext?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
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
function SizeIt() {
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
            <button key={o} disabled={picked !== null} onClick={() => setPicked(o)}
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
function ReadStructure() {
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
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["up", "down", "range"] as const).map((k) => {
          const isAns = k === round.answer, isPicked = k === picked;
          return (
            <button key={k} disabled={picked !== null} onClick={() => setPicked(k)}
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
function SpotLevel() {
  // Tap near the support line (~y for value 44). We reveal after a tap.
  const data = [50, 44, 62, 45, 64, 44, 60, 46, 63];
  const W = 260, H = 120, min = 40, max = 70;
  const x = (i: number) => 10 + (i / (data.length - 1)) * (W - 20);
  const y = (v: number) => H - 12 - ((v - min) / (max - min)) * (H - 24);
  const supportY = y(45);
  const [tapY, setTapY] = useState<number | null>(null);
  const path = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const close = tapY != null && Math.abs(tapY - supportY) < 14;
  return (
    <div>
      <p className="mb-2 text-sm text-ink-2">Tap where <span className="text-gain">support</span> is — the floor price keeps bouncing off.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full rounded-lg bg-bg2 cursor-crosshair"
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setTapY(((e.clientY - r.top) / r.height) * H);
        }}>
        <polyline points={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.8" />
        {tapY != null && (
          <>
            <line x1="10" x2={W - 10} y1={tapY} y2={tapY} stroke={close ? "var(--gain)" : "var(--loss)"} strokeWidth="1.5" strokeDasharray="4 3" />
            <motion.line x1="10" x2={W - 10} y1={supportY} y2={supportY} stroke="var(--gain)" strokeWidth="1.5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          </>
        )}
      </svg>
      {tapY != null && (
        <Verdict right={close}
          text={close ? "That's the level — price tested it three times and held each time. Buyers defend it." : "Look for the price where the line bottomed out again and again — that repeated floor is support (the solid green line)."}
          onNext={() => setTapY(null)} />
      )}
    </div>
  );
}

/* ---------- Order match ---------- */
function OrderMatch() {
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
            <button key={o} disabled={picked !== null} onClick={() => setPicked(o)}
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
