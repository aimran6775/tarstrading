/*
  Analyst sigils — each automated analyst wears an original geometric mark,
  drawn to the house spec (24-unit grid, stroke 1.6, round caps), never an
  emoji and never a face. The mark states the desk's one idea:

    trend      a course line climbing through a compass ring
    dip        a curve that falls, bottoms, and is caught by a rising arrow
    breakout   a channel ceiling pierced by an ascending bolt
    reverter   two rails and a swing returning to the mean line
    momentum   three accelerating strokes behind an arrowhead
    sentinel   a shield with a single steady baseline inside
    custom     a signet ring around a plotted point (hand-built strategies)

  Rendered in currentColor so the same mark reads in the agent violet on the
  floor, in ink in a list, and inverted on a fill.
*/

export type SigilName =
  | "trend" | "dip" | "breakout" | "reverter" | "momentum" | "sentinel" | "custom";

/** Old rows stored emoji in this field; anything unrecognized wears the
    custom signet rather than breaking. */
export function sigilOf(value: string | null | undefined): SigilName {
  const v = (value ?? "").trim();
  return (["trend", "dip", "breakout", "reverter", "momentum", "sentinel"] as const)
    .includes(v as Exclude<SigilName, "custom">) ? (v as SigilName) : "custom";
}

export function AnalystSigil({ sigil, className = "h-5 w-5" }: {
  sigil: SigilName | string | null | undefined;
  className?: string;
}) {
  const name = sigilOf(typeof sigil === "string" ? sigil : null);
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {name === "trend" && (
        <>
          <circle cx="12" cy="12" r="9.2" opacity="0.35" />
          <path d="M5.6 15.8 10 11.6l3 2.4 5.4-6" />
          <path d="M15.2 8h3.2v3.2" />
        </>
      )}
      {name === "dip" && (
        <>
          <path d="M4.2 6.5c2.6 3.4 3.6 8.6 5.6 10.4 1.1 1 2.6.9 3.7-.4" opacity="0.55" />
          <path d="M11.5 14.5 15 18l5-8.4" />
          <path d="M17.6 9.1 20 9.6l-.6 2.4" />
        </>
      )}
      {name === "breakout" && (
        <>
          <path d="M4 8.4h6.2M13.8 8.4H20" opacity="0.45" />
          <path d="M8.2 19 12 12.6l2.2 2.2 3.6-9" />
          <path d="M15.4 5.6 17.8 5l.6 2.4" />
        </>
      )}
      {name === "reverter" && (
        <>
          <path d="M4 6.8h16M4 17.2h16" opacity="0.35" />
          <path d="M4.6 12h14.8" opacity="0.55" strokeDasharray="2.5 2.8" />
          <path d="M6 15.6c2.4 0 2.6-7.2 5-7.2s2.7 6 5.2 4.4" />
          <path d="M14.6 13.4l1.6-.6.5 1.7" />
        </>
      )}
      {name === "momentum" && (
        <>
          <path d="M4 15.5h4.2" opacity="0.35" />
          <path d="M5.4 12h6" opacity="0.55" />
          <path d="M7 8.5h7.6" opacity="0.8" />
          <path d="M12.6 15.2 19.6 8.2M19.6 8.2h-4M19.6 8.2v4" />
        </>
      )}
      {name === "sentinel" && (
        <>
          <path d="M12 3.6 19 6.4v5.2c0 4.4-2.9 7.4-7 9-4.1-1.6-7-4.6-7-9V6.4Z" />
          <path d="M8.4 12.4h3l1.4-2.2 1.6 3.4 1.2-1.2" opacity="0.8" />
        </>
      )}
      {name === "custom" && (
        <>
          <circle cx="12" cy="12" r="8.6" opacity="0.4" />
          <circle cx="12" cy="12" r="4.6" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2" opacity="0.55" />
        </>
      )}
    </svg>
  );
}
