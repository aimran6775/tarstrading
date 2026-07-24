"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/*
  The hero backdrop — the real market-footage loop (public/main-search-video.mp4)
  under a legibility scrim, replacing the old WebGL orbital. Cheap (one <video>,
  no three.js in the bundle), muted/inline/looping, and honest about motion:
  with prefers-reduced-motion the video holds its first frame instead of
  playing. Always paired with a gradient so foreground text passes contrast.
*/
export default function VideoHero({ className = "", dim = 0.55 }: { className?: string; dim?: number }) {
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
      {/* uniform dim + upward scrim so copy stays readable on any frame */}
      <div className="absolute inset-0" style={{ background: `oklch(0.13 0.02 280 / ${dim})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-bg0 via-transparent to-bg0/40" />
    </div>
  );
}
