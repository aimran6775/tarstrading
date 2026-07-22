/* The Tars mark — an orbiting core. Shared across landing, footer, error pages. */
export default function OrbGlyph({ size = 28 }: { size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-0 rounded-full border border-gold/40" />
      <span className="absolute rounded-[50%] border border-gold/70"
        style={{ width: size * 1.12, height: size * 0.38 }} />
      <span className="rounded-full bg-gold" style={{ width: size * 0.14, height: size * 0.14 }} />
    </span>
  );
}
