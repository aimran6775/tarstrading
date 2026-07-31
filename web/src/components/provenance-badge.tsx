import { PROVENANCE_HELP, provenanceLabel, type Provenance } from "@/components/trading/shared";

/*
  The provenance badge — the PAPER-banner principle applied to data. Every
  price on the platform can say where it came from: LIVE (websocket tick),
  DELAYED 15M (consolidated SIP), EOD (official close), DERIVED (computed from
  a proxy), INDICATIVE (modeled). Restrained by design: a tiny mono label in
  the ink ramp, with color spent only on LIVE — the one state worth signaling.
*/

export function ProvenanceBadge({ source, symbol, className = "" }: {
  source: Provenance | null | undefined;
  /** Lets a delayed equity read AFTER HOURS outside the session (gap 15). */
  symbol?: string;
  className?: string;
}) {
  if (!source) return null;
  const live = source === "live";
  return (
    <span
      title={PROVENANCE_HELP[source]}
      /* 8.5px carried meaning below any legible minimum (gap 39). 10px with
         the same tracking stays a quiet chip and can actually be read. */
      className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] ${
        live ? "text-gain" : "text-ink-4"
      } ${className}`}
    >
      {live && (
        <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-gain motion-safe:animate-pulse" />
      )}
      {provenanceLabel(source, symbol)}
    </span>
  );
}
