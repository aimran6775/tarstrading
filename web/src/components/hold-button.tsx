"use client";

import { useRef, useState } from "react";

/*
  Hold-to-submit — the signature interaction, ported from the iOS ticket.
  Hold 600ms while a ring traces the button; release early and it springs
  back. Deliberate, unmistakable, impossible to fat-finger. Keyboard users
  press Enter (deliberateness there comes from focus + explicit key).
*/

export default function HoldButton({
  label, holdLabel = "Hold…", disabled, tone = "gold", onCommit,
}: {
  label: string;
  holdLabel?: string;
  disabled?: boolean;
  tone?: "gold" | "loss";
  onCommit: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number>(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<number>(0);
  const done = useRef(false);

  const DURATION = 600;

  function begin() {
    if (disabled || done.current) return;
    start.current = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - start.current) / DURATION, 1);
      setProgress(k);
      if (k >= 1) { finish(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // Backstop: rAF can be throttled (background tabs, embedded webviews).
    // If the pointer is still down at DURATION, the hold commits regardless.
    timeout.current = setTimeout(finish, DURATION + 40);
  }

  function cancel() {
    if (done.current) return;
    cancelAnimationFrame(raf.current);
    if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
    setProgress(0);
  }

  function finish() {
    if (done.current) return;
    done.current = true;
    cancelAnimationFrame(raf.current);
    if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
    setProgress(1);
    onCommit();
    // Re-arm shortly after so the parent's phase change swaps the UI first.
    setTimeout(() => { done.current = false; setProgress(0); }, 600);
  }

  const toneStyles = tone === "gold"
    ? "cta-gold"
    : "bg-loss/15 text-loss border border-loss/40";

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      // Keyboard activation arrives as a click with detail === 0 (the
      // standard pattern) — commit directly; deliberateness for keyboard
      // users comes from explicit focus + activation.
      onClick={(e) => { if (e.detail === 0) finish(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } }}
      className={`pressable relative w-full overflow-hidden rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-50 ${toneStyles}`}
      aria-label={`${label}. Press and hold to confirm.`}
    >
      {/* Progress sweep */}
      <span
        aria-hidden
        className="absolute inset-0 origin-left"
        style={{
          transform: `scaleX(${progress})`,
          background: tone === "gold"
            ? "oklch(1 0 0 / 0.28)"
            : "oklch(from var(--loss) l c h / 0.35)",
          transition: progress === 0 ? "transform 260ms cubic-bezier(0.32,0.72,0,1)" : "none",
        }}
      />
      <span className="relative">{progress > 0.02 && progress < 1 ? holdLabel : label}</span>
    </button>
  );
}
