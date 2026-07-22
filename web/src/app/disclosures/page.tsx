import Link from "next/link";
import TarsMark from "@/components/tars-mark";

export const metadata = { title: "Disclosures" };

export default function Disclosures() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16 md:px-0">
      <Link href="/" className="inline-flex items-center gap-2">
        <TarsMark size={24} />
        <span className="font-display text-sm font-bold tracking-[0.08em] text-ink-1">TARS TRADING</span>
      </Link>
      <p className="kicker mt-10">The fine print, in plain language</p>
      <h1 className="display mt-3 text-4xl text-ink-1 md:text-5xl">It&apos;s all simulated.</h1>

      <div className="mt-8 flex flex-col gap-6 text-[16px] leading-[1.65] text-ink-2">
        <p>
          Every dollar on Tars Trading is <strong className="text-ink-1">simulated</strong>. The
          $100,000 you start with isn&apos;t real, the fills aren&apos;t real, and nothing you
          do here moves actual money. That is the entire point — this is a place to build
          skill before skill costs you anything.
        </p>
        <p>
          <strong className="text-ink-1">Not investment advice.</strong> Tars, the academy, and
          everything on this site are educational. Nothing here is a recommendation to buy,
          sell, or hold any security. Tars the mentor will never give you a directive
          trade — by design.
        </p>
        <p>
          <strong className="text-ink-1">No brokerage, no custody.</strong> Tars Trading is not a
          broker-dealer, does not execute real orders, and never holds your money or
          securities. Market data is provided for education and may be delayed or
          incomplete; when a quote is stale, the terminal says so.
        </p>
        <p>
          <strong className="text-ink-1">Simulated results never promise real ones.</strong> A
          strategy that worked on historical or simulated data can fail with real capital.
          Backtests here separate in-sample from out-of-sample precisely because past
          performance — even honest past performance — does not predict the future.
        </p>
        <p>
          Trade the practice account like it&apos;s real, and let the lessons — not the losses —
          be the expensive part.
        </p>
      </div>

      <Link href="/app" className="pressable cta-gold mt-10 inline-block rounded-full px-7 py-3 text-sm font-semibold">
        Back to the desk
      </Link>
    </main>
  );
}
