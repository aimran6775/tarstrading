import Link from "next/link";

/*
  The guided first trade — the moment a lesson stops being theory. It's handed
  the learner's ACTUAL paper-account numbers (fetched server-side by the lesson
  page, so there's no loading spinner and nothing to hydrate) and turns the
  sizing rule into their reality: "you have $X, so one trade risks $Y." If
  they've already traded, it reads back the risk they're carrying.
*/

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function GuidedTrade({ equity, positionCount }: { equity: number | null; positionCount: number }) {
  return (
    <div className="card border-l-2 border-l-gain p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gain">Your first trade — for real</p>

      {equity == null ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          The rule holds whatever your balance: risk about 1% on any single trade. Head to the{" "}
          <Link href="/app" className="text-gain hover:underline">desk</Link> when you&apos;re ready.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Your account" value={money(equity)} />
            <Stat label="1% risk — your max loss per trade" value={money(equity * 0.01)} tone="gain" />
          </div>

          {positionCount > 0 ? (
            <p className="text-sm leading-relaxed text-ink-2">
              You&apos;re already holding <span className="text-ink-1">{positionCount} position{positionCount === 1 ? "" : "s"}</span> — good,
              you&apos;ve started. Now check each one has a stop, and that the loss to that stop is no more than about {money(equity * 0.01)}.
              If it&apos;s more, the position is too big for this account.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              You haven&apos;t traded yet. Here&apos;s your first one, sized the professional way — decide it before you click, not after.
            </p>
          )}

          <ol className="flex flex-col gap-2 text-sm text-ink-2">
            <Step n={1}>Pick a symbol on the desk and open its chart.</Step>
            <Step n={2}>Decide your entry, and the price that proves you wrong — your stop.</Step>
            <Step n={3}>Size it so <span className="tnum text-ink-1">(entry − stop) × shares ≈ {money(equity * 0.01)}</span>. Never more.</Step>
            <Step n={4}>Place the trade with the stop set. You&apos;ve now defined your worst case before it happened.</Step>
          </ol>

          <Link href="/app" className="pressable cta-gold self-start rounded-full px-5 py-2.5 text-sm font-semibold">
            {positionCount > 0 ? "Review your positions" : "Place your first trade"}
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ink-1" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 text-xl font-semibold text-${tone}`}>{value}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg3 text-[11px] font-semibold text-ink-2">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
