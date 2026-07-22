"use client";

import { useEffect, useRef, useState } from "react";

/*
  Hold-to-submit — the signature interaction, ported from the iOS ticket.
  Hold 600ms while a ring traces the button; release early and it springs
  back. Deliberate, unmistakable, impossible to fat-finger.

  Touch safety (this control commits money): a scroll that starts on the
  button fires pointercancel — we must treat that as a cancel, and the
  time-based backstop must NEVER commit unless the pointer is still down.
  Pointer capture + touch-action:none keep the gesture from drifting away.
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
  const rearm = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<number>(0);
  const pressing = useRef(false);
  const done = useRef(false);

  const DURATION = 600;

  function clearTimers() {
    cancelAnimationFrame(raf.current);
    if (timeout.current) { clearTimeout(timeout.current); timeout.current = null; }
  }

  // Cancel every pending timer if the component unmounts mid-hold (e.g. the
  // ticket symbol changes) — no setState-after-unmount, no orphan commit.
  useEffect(() => () => {
    clearTimers();
    if (rearm.current) clearTimeout(rearm.current);
  }, []);

  function begin(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || done.current) return;
    pressing.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    start.current = performance.now();
    const tick = (t: number) => {
      if (!pressing.current) return;
      const k = Math.min((t - start.current) / DURATION, 1);
      setProgress(k);
      if (k >= 1) { finish(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // Backstop for throttled rAF (background/embedded webviews): only commits
    // if the pointer is STILL down. A cancelled gesture can never fire this.
    timeout.current = setTimeout(() => { if (pressing.current) finish(); }, DURATION + 40);
  }

  function cancel() {
    pressing.current = false;
    if (done.current) return;
    clearTimers();
    setProgress(0);
  }

  function finish() {
    if (done.current) return;
    done.current = true;
    pressing.current = false;
    clearTimers();
    setProgress(1);
    onCommit();
    // Re-arm shortly after so the parent's phase change swaps the UI first.
    rearm.current = setTimeout(() => { done.current = false; setProgress(0); }, 600);
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
      onPointerCancel={cancel}
      // Keyboard activation arrives as a click with detail === 0; commit
      // directly — deliberateness there comes from focus + explicit key.
      onClick={(e) => { if (e.detail === 0) finish(); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } }}
      style={{ touchAction: "none" }}
      className={`pressable relative w-full overflow-hidden rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-50 ${toneStyles}`}
      aria-label={`${label}. Press and hold to confirm.`}
    >
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
