"use client";
import { useId } from "react";

/*
  The Tars mark — "Ascent." A faceted, folded up-delta: two gold planes meeting
  at a razor ridge, with a lit left face, a shadowed right face, and a real
  underside thickness so it reads as a solid object, not a flat arrow. It says
  what the product is in one glyph — markets up-and-to-the-right, the Greek Δ of
  returns, and the crafted precision of a professional desk.

  Depth is faked the honest way — flat-shaded facets plus one metallic sheen —
  so it stays crisp from a 16px favicon to a hero, and renders anywhere (no SVG
  filters). Facet tones are color-mixed off the single --gold token, so the mark
  reverses cleanly between light and dark with the rest of the theme.

  Pass `animate` at a brand moment (auth, error, a hero): the body rises into
  place, the ridge draws down from the apex, and the spark lights. Reduced-
  motion is respected in globals.css.
*/
export default function TarsMark({
  size = 28, className, animate = false,
}: { size?: number; className?: string; animate?: boolean }) {
  // Strip colons React's useId emits — they break url(#id) refs in SVG.
  const uid = "tm-" + useId().replace(/:/g, "");
  const G = (mix: string) => `color-mix(in oklab, var(--gold), ${mix})`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      className={`${animate ? "tars-anim " : ""}${className ?? ""}`.trim() || undefined}
      role="img" aria-label="Tars">
      <defs>
        {/* Metallic sheen raked across the lit face, top-bright to bottom-clear. */}
        <linearGradient id={`${uid}-sheen`} x1="20" y1="11" x2="20" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.30" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Falloff down the shadowed face. */}
        <linearGradient id={`${uid}-fall`} x1="32" y1="11" x2="48" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
        {/* Soft contact shadow grounding the form. */}
        <radialGradient id={`${uid}-cast`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.34" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* contact shadow */}
      <ellipse className="am-cast" cx="32" cy="51" rx="21" ry="3.6" fill={`url(#${uid}-cast)`} />

      <g className="am-body" style={{ transformBox: "view-box", transformOrigin: "32px 30px" }}>
        {/* underside thickness — the deepest facets, read as the object's depth */}
        <path d="M9 42 L22 42 L22 46 L9 46 Z" style={{ fill: G("black 50%") }} />
        <path d="M42 42 L55 42 L55 46 L42 46 Z" style={{ fill: G("black 50%") }} />

        {/* shadowed right face */}
        <path d="M32 11 L55 42 L42 42 L32 31.5 Z" style={{ fill: G("black 26%") }} />
        <path d="M32 11 L55 42 L42 42 L32 31.5 Z" fill={`url(#${uid}-fall)`} />

        {/* lit left face + sheen */}
        <path d="M32 11 L32 31.5 L22 42 L9 42 Z" style={{ fill: G("white 12%") }} />
        <path d="M32 11 L32 31.5 L22 42 L9 42 Z" fill={`url(#${uid}-sheen)`} />

        {/* leading-edge bevels — the light catching the folded edges */}
        <path className="am-edge" d="M32 11 L9 42" fill="none" style={{ stroke: G("white 52%") }} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.55" />
        <path d="M32 11 L55 42" fill="none" style={{ stroke: G("white 40%") }} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.22" />

        {/* the razor ridge — brightest, where the fold meets the light */}
        <path className="am-ridge" d="M32 11 L32 31.5" fill="none" style={{ stroke: G("white 60%") }} strokeWidth="1.4" strokeLinecap="round" />

        {/* apex spark */}
        <circle className="am-spark" cx="32" cy="11" r="1.7" style={{ fill: G("white 72%") }} />
      </g>
    </svg>
  );
}
