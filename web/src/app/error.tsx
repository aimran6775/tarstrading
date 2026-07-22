"use client";

import { useEffect } from "react";
import TarsMark from "@/components/tars-mark";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <TarsMark size={40} animate />
      <p className="kicker mt-8">Something broke</p>
      <h1 className="display mt-3 text-4xl text-ink-1 md:text-5xl">The desk hit an error.</h1>
      <p className="mt-4 max-w-sm text-base text-ink-2">
        No positions were harmed — everything here is simulated. Try again, and if it
        keeps happening, the market will still be here tomorrow.
      </p>
      <button onClick={reset} className="pressable cta-gold mt-8 rounded-full px-7 py-3 text-sm font-semibold">
        Try again
      </button>
    </main>
  );
}
