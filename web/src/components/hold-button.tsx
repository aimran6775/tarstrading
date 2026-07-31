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
  // The no-hold alternative's armed state (gap 40).
  const [twoStep, setTwoStep] = useState(false);
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

  // An armed two-step confirm disarms itself after 8 seconds, so a stray tap
  // can never leave a live commit button waiting (gap 40).
  useEffect(() => {
    if (!twoStep) return;
    const id = setTimeout(() => setTwoStep(false), 8_000);
    return () => clearTimeout(id);
  }, [twoStep]);

  /** Start the hold. Shared by pointer and keyboard so both must really hold. */
  function startHold() {
    if (disabled || done.current) return;
    pressing.current = true;
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

  function begin(e: React.PointerEvent<HTMLButtonElement>) {
    // Capture the pointer so a drag off the button still reports its release.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    startHold();
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
    <>
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      /*
        Keyboard users must HOLD too. This previously committed on a single
        keydown for Enter OR Space — so a keyboard user who focused "Buy 1 AAPL"
        and tapped Space to scroll the page placed a live order, while the
        button's own label promised "press and hold to confirm". The safeguard
        existed only for mice.

        Now the key press starts the same timer a pointer does, and releasing
        early cancels it exactly like lifting a finger. The click handler no
        longer commits — keydown/keyup own the keyboard path entirely, so
        nothing can fire twice.
      */
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (e.repeat) return; // auto-repeat must not restart the hold
        startHold();
      }}
      onKeyUp={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        cancel();
      }}
      onBlur={cancel}
      style={{ touchAction: "none" }}
      className={`pressable relative w-full overflow-hidden rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-50 ${toneStyles}`}
      aria-label={`${label}. Press and hold to confirm — release early to cancel.`}
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

    {/*
      The no-hold path (gap 40). A sustained ~900ms press is a real barrier
      for tremor, limited dexterity, or switch access — and WCAG asks that
      any timing-dependent action have an alternative. Two deliberate taps
      carry the same intent as one deliberate hold: nothing fires on the
      first, and the confirm state times out so a stray tap can't leave a
      live button armed.
    */}
    {!disabled && (
      <div className="mt-1.5 text-center">
        {twoStep ? (
          <span className="inline-flex items-center gap-2">
            <button type="button" onClick={() => { setTwoStep(false); finish(); }}
              className={`pressable min-h-9 rounded-full px-4 text-xs font-semibold ${
                tone === "gold" ? "bg-gold/20 text-gold" : "bg-loss/20 text-loss"
              }`}>
              Confirm {label}
            </button>
            <button type="button" onClick={() => setTwoStep(false)}
              className="pressable min-h-9 px-2 text-xs text-ink-4 hover:text-ink-2">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setTwoStep(true)}
            className="pressable min-h-9 text-[11px] text-ink-4 underline decoration-dotted underline-offset-4 hover:text-ink-2">
            Can&apos;t hold? Confirm in two taps
          </button>
        )}
      </div>
    )}
    </>
  );
}
