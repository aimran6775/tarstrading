/*
  The room's air. A single fixed grain layer (kills banding on the big dark
  grounds, adds tactility) plus an optional ambient aura. Mounted once at the
  top of the authenticated shell, behind everything, aria-hidden and
  pointer-events:none — it never touches interaction, only atmosphere.
*/
export default function Atmosphere() {
  return (
    <>
      <div aria-hidden className="grain" />
      {/* one soft gold dawn at the top of the room — dialed down in daylight
          (see .app-dawn in globals.css) so it lifts, never washes. */}
      <div aria-hidden className="app-dawn pointer-events-none fixed inset-x-0 top-0 z-0 h-[38vh]"
        style={{ background: "radial-gradient(55% 100% at 50% 0%, var(--glow-gold), transparent 72%)" }} />
    </>
  );
}
