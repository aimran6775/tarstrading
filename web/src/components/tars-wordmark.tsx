import TarsMark from "./tars-mark";

/*
  The Tars lockup — the mark paired with the wordmark, spaced and sized as one
  unit so every surface reads the brand identically. Type scales off the mark
  so the lockup stays balanced at any size. Pass `text="TARS TRADING"` for the
  full form (footer, brand moments); `animate` boots the mark on mount.
*/
export default function TarsWordmark({
  size = 28, text = "TARS", animate = false, className,
}: { size?: number; text?: string; animate?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`.trim()}>
      <TarsMark size={size} animate={animate} />
      <span className="font-display font-bold leading-none tracking-[0.11em] text-ink-1"
        style={{ fontSize: Math.round(size * 0.6) }}>{text}</span>
    </span>
  );
}
