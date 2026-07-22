"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="kicker">Couldn&apos;t load this</p>
      <h1 className="display mt-3 text-2xl text-ink-1 md:text-3xl">This surface hit a snag.</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-2">A refresh usually clears it. Your account is untouched.</p>
      <button onClick={reset} className="pressable cta-gold mt-6 rounded-full px-6 py-2.5 text-sm font-semibold">
        Retry
      </button>
    </div>
  );
}
