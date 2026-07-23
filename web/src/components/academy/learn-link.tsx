import Link from "next/link";
import { CONCEPT_LESSON } from "@/lib/academy";

/*
  A subtle "learn this" chip that deep-links a concept anywhere in the app to
  the lesson that teaches it — so the Academy lives throughout the product, not
  just in its own tab. Keyed by concept so callers stay decoupled from lesson
  ids. Renders nothing for an unknown concept.
*/
export default function LearnLink({ concept, className = "" }: { concept: string; className?: string }) {
  const l = CONCEPT_LESSON[concept];
  if (!l) return null;
  return (
    <Link href={`/app/academy/${l.id}`}
      className={`pressable inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[10px] font-medium text-ink-4 hover:border-gold/40 hover:text-gold ${className}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4L2 9l10 5 8-4v6M6 12v4c0 1 3 2 6 2s6-1 6-2v-4" />
      </svg>
      Learn: {l.label}
    </Link>
  );
}
