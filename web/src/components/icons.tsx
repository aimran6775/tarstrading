/*
  The Tars icon set — hand-drawn inline SVGs, no emoji anywhere in the product.
  Stroke-based at 24×24 (stroke 1.75, round caps) so they read crisply at chip
  size and inherit color via currentColor. The one filled glyph is GoldBlock —
  the academy's currency — a faceted cube shaded like the Ascent logo so the
  brand's material (folded tape-gold) carries through the whole system.

  Usage: <Icon.Chart className="h-4 w-4 text-gold" />
*/

type P = { className?: string; strokeWidth?: number };

function Svg({ className, children, filled = false, strokeWidth = 1.75 }: P & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** The gold block — a faceted cube in the logo's material. Fixed gold facets
    (not currentColor) so it always reads as the currency, on any ground. */
export function GoldBlock({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path d="M12 2.6 L21 7.4 L12 12.2 L3 7.4 Z" fill="color-mix(in oklab, var(--gold), white 18%)" />
      <path d="M3 7.4 L12 12.2 L12 21.4 L3 16.6 Z" fill="color-mix(in oklab, var(--gold), black 8%)" />
      <path d="M21 7.4 L12 12.2 L12 21.4 L21 16.6 Z" fill="color-mix(in oklab, var(--gold), black 34%)" />
      <path d="M12 2.6 L21 7.4 M12 2.6 L3 7.4" stroke="color-mix(in oklab, var(--gold), white 55%)" strokeWidth="0.8" />
    </svg>
  );
}

export const Icon = {
  GoldBlock,

  /** Rising equity line with an emphasized endpoint. */
  Chart: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 19.5 L9 13.5 L13 16 L20.5 7" />
      <circle cx="20.5" cy="7" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  ),

  /** Candlesticks — the terminal. */
  Candles: (p: P) => (
    <Svg {...p}>
      <path d="M7 5 v3 M7 16 v3 M7 8 h0" /><rect x="5.4" y="8" width="3.2" height="8" rx="0.8" />
      <path d="M17 3.5 v3 M17 13.5 v4" /><rect x="15.4" y="6.5" width="3.2" height="7" rx="0.8" />
    </Svg>
  ),

  /** Compass — navigation, the tour, finding your way. */
  Compass: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8 L13.4 13.4 L8.8 15.2 L10.6 10.6 Z" fill="currentColor" stroke="none" />
    </Svg>
  ),

  /** Graduation cap — the academy. */
  Academy: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 9.5 L12 4.5 L21.5 9.5 L12 14.5 Z" />
      <path d="M6.5 12 v4.2 c0 1.2 2.5 2.6 5.5 2.6 s5.5 -1.4 5.5 -2.6 V12" />
      <path d="M21.5 9.5 v5" />
    </Svg>
  ),

  /** Analyst — a headset desk operator, not a robot. */
  Analyst: (p: P) => (
    <Svg {...p}>
      <path d="M4.5 13 a7.5 7.5 0 0 1 15 0" />
      <rect x="3" y="12.5" width="3.4" height="5.5" rx="1.6" />
      <rect x="17.6" y="12.5" width="3.4" height="5.5" rx="1.6" />
      <path d="M19.3 18 a4.5 4.5 0 0 1 -4.3 3.2 h-1.5" />
    </Svg>
  ),

  /** Bolt — actions, live, execution. */
  Bolt: (p: P) => (
    <Svg {...p}>
      <path d="M13 2.5 L5 13.5 h5.5 L11 21.5 L19 10.5 h-5.5 Z" />
    </Svg>
  ),

  /** Target — missions, precision, discipline. */
  Target: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  ),

  /** Flame — the practice streak. */
  Flame: (p: P) => (
    <Svg {...p}>
      <path d="M12 3 c1 3.2 4.2 4.6 4.2 8.4 a4.2 4.2 0 0 1 -8.4 0 c0 -1.6 0.7 -2.8 1.5 -3.9 c0.3 1 .9 1.8 1.8 2.3 C10.6 7.6 10.9 5 12 3 Z" />
      <path d="M9.5 16.5 a7 7 0 0 0 5 0" opacity="0.5" />
    </Svg>
  ),

  /** Laurel trophy — achievements, the leaderboard. */
  Trophy: (p: P) => (
    <Svg {...p}>
      <path d="M8 4.5 h8 v4 a4 4 0 0 1 -8 0 Z" />
      <path d="M8 5.5 H5 a3 3 0 0 0 3 3.5 M16 5.5 h3 a3 3 0 0 1 -3 3.5" />
      <path d="M12 12.5 v3 M8.5 19.5 h7 M10 19.5 v-2 a2 2 0 0 1 4 0 v2" />
    </Svg>
  ),

  /** Journal — the trade log, theses, the honest record. */
  Journal: (p: P) => (
    <Svg {...p}>
      <path d="M6 3.5 h11.5 a1 1 0 0 1 1 1 v15 a1 1 0 0 1 -1 1 H6 a1.5 1.5 0 0 1 -1.5 -1.5 v-15 A1.5 1.5 0 0 1 6 3.5 Z" />
      <path d="M8.5 8 h7 M8.5 11.5 h7 M8.5 15 h4.5" />
    </Svg>
  ),

  /** Shield — risk, stops, protection. */
  Shield: (p: P) => (
    <Svg {...p}>
      <path d="M12 3 L19.5 6 v5.5 c0 4.6 -3.2 7.6 -7.5 9.5 c-4.3 -1.9 -7.5 -4.9 -7.5 -9.5 V6 Z" />
      <path d="M8.8 12 l2.2 2.2 L15.4 9.8" />
    </Svg>
  ),

  /** Globe with meridian — world clock, the footer. */
  Globe: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12 h17 M12 3.5 c2.6 2.3 3.9 5.2 3.9 8.5 s-1.3 6.2 -3.9 8.5 c-2.6 -2.3 -3.9 -5.2 -3.9 -8.5 s1.3 -6.2 3.9 -8.5 Z" />
    </Svg>
  ),

  /** Sliders — filters, settings. */
  Sliders: (p: P) => (
    <Svg {...p}>
      <path d="M4 7.5 h9 M17.5 7.5 H20 M4 16.5 h2.5 M11 16.5 h9" />
      <circle cx="15.2" cy="7.5" r="2.2" /><circle cx="8.8" cy="16.5" r="2.2" />
    </Svg>
  ),

  /** Spark — delight, the "new" marker, a brand moment. */
  Spark: (p: P) => (
    <Svg {...p}>
      <path d="M12 3.5 L13.8 10.2 L20.5 12 L13.8 13.8 L12 20.5 L10.2 13.8 L3.5 12 L10.2 10.2 Z" fill="currentColor" stroke="none" />
    </Svg>
  ),

  /** Arrow up-right — gains, ascent, "go". */
  Ascend: (p: P) => (
    <Svg {...p}>
      <path d="M6 18 L18 6 M9.5 6 H18 v8.5" />
    </Svg>
  ),
};
