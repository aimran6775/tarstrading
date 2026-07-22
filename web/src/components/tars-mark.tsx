"use client";
import { useId } from "react";

/*
  The Tars mark — an attitude indicator (the cockpit instrument that shows a
  pilot which way is up) with the horizon climbing like a bid. It makes the
  brand line — "a flight simulator for markets" — literal, in the one accent
  the product owns: tape gold. Drawn in theme tokens so it reverses cleanly on
  dark or light; the center reference doubles as a candlestick tick.
*/
export default function TarsMark({ size = 28, className }: { size?: number; className?: string }) {
  // Strip colons React's useId emits — they break url(#id) refs in SVG.
  const clip = "tars-" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      className={className} role="img" aria-label="Tars">
      <circle cx="32" cy="32" r="26" stroke="var(--gold)" strokeWidth="2.4" />
      <clipPath id={clip}><circle cx="32" cy="32" r="24.6" /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {/* the climbing horizon and its lit "ground" */}
        <path d="M4 40 L60 24 L60 60 L4 60 Z" fill="var(--gold)" fillOpacity="0.16" />
        <line x1="4" y1="40" x2="60" y2="24" stroke="var(--gold)" strokeWidth="2.4" />
      </g>
      {/* aircraft reference marks — also read as a candlestick tick */}
      <g stroke="var(--ink-1)" strokeWidth="2.6" strokeLinecap="round">
        <line x1="20" y1="33" x2="27" y2="33" />
        <line x1="37" y1="33" x2="44" y2="33" />
      </g>
      <circle cx="32" cy="33" r="2.6" fill="var(--gold)" />
    </svg>
  );
}
