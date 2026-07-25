"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/*
  The hero backdrop — real market-footage loop under a legibility scrim.

  THEME CONTRACT: the scene is a committed dark world in BOTH themes. Scrims
  are fixed dark constants (never theme vars — var(--bg0) is near-white in
  light mode and turned the footage into fog). Copy placed over this backdrop
  must use the .scene-ink utilities, never theme ink tokens. Only `blend`
  fades the bottom edge into the CURRENT page background so the scene hands
  off cleanly to themed content below.

  Honest about motion: prefers-reduced-motion holds the first frame.
*/
export default function VideoHero({
  className = "", dim = 0.55, blend = true,
}: { className?: string; dim?: number; blend?: boolean }) {
  const rm = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (rm) { v.pause(); return; }
    // Autoplay can be blocked; a paused first frame is a fine fallback.
    v.play().catch(() => {});
  }, [rm]);

  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`}>
      <video
        ref={ref}
        className="h-full w-full object-cover"
        src="/main-search-video.mp4"
        muted
        loop
        playsInline
        autoPlay={!rm}
        preload="metadata"
      />
      {/* fixed DARK dim — identical in both themes, keeps scene-ink legible */}
      <div className="absolute inset-0" style={{ background: `oklch(0.13 0.02 280 / ${dim})` }} />
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to top, oklch(0.13 0.02 280 / 0.55), transparent 45%, oklch(0.13 0.02 280 / 0.35))" }} />
      {/* boundary: a short fade into the PAGE theme so the handoff is seamless */}
      {blend && (
        <div className="absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(to top, var(--bg0), transparent)" }} />
      )}
    </div>
  );
}
