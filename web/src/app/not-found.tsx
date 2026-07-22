import Link from "next/link";
import TarsMark from "@/components/tars-mark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <TarsMark size={40} animate />
      <p className="kicker mt-8">404 · off the tape</p>
      <h1 className="display mt-3 text-4xl text-ink-1 md:text-6xl">Nothing trades here.</h1>
      <p className="mt-4 max-w-sm text-base text-ink-2">
        This page doesn&apos;t exist — or it moved while you weren&apos;t watching the ticker.
      </p>
      <Link href="/app" className="pressable cta-gold mt-8 rounded-full px-7 py-3 text-sm font-semibold">
        Back to the desk
      </Link>
    </main>
  );
}
