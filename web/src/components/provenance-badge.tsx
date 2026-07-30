import { PROVENANCE_HELP, PROVENANCE_LABEL, type Provenance } from "@/components/trading/shared";

/*
  The provenance badge — the PAPER-banner principle applied to data. Every
  price on the platform can say where it came from: LIVE (websocket tick),
  DELAYED 15M (consolidated SIP), EOD (official close), DERIVED (computed from
  a proxy), INDICATIVE (modeled). Restrained by design: a tiny mono label in
  the ink ramp, with color spent only on LIVE — the one state worth signaling.
*/

export function ProvenanceBadge({ source, className = "" }: {
  source: Provenance | null | undefined;
  className?: string;
}) {
  if (!source) return null;
  const live = source === "live";
  return (
    <span
      title={PROVENANCE_HELP[source]}
      className={`inline-flex items-center gap-1 whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.14em] ${
        live ? "text-gain" : "text-ink-4"
      } ${className}`}
    >
      {live && (
        <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-gain motion-safe:animate-pulse" />
      )}
      {PROVENANCE_LABEL[source]}
    </span>
  );
}
