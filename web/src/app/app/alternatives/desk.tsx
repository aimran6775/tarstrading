"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import CommitmentCard from "@/components/private/commitment-card";
import FundCard from "@/components/private/fund-card";
import PortfolioSummary from "@/components/private/summary";
import { multiple, money, type PrivateData } from "@/components/private/types";

/*
  The Alternatives desk — the allocator's side of the house.

  Deliberately unlike the trading floor: nothing blinks, nothing streams, the
  clock is quarters rather than ticks, and the page is read more than it is
  operated. Private markets move slowly and the surface should say so.

  Data is fetched once and refreshed on demand or when you come back to the
  tab. The simulated clock advances about a quarter an hour, so there is
  nothing to poll for — a fund does not change between one blink and the next.
*/

export default function AlternativesDesk() {
  const [data, setData] = useState<PrivateData | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openFund, setOpenFund] = useState<string | null>(null);
  const lastLoad = useRef(0);

  const apply = useCallback((d: { ok?: boolean } | null) => {
    if (d?.ok) { setData(d as PrivateData); setError(false); lastLoad.current = Date.now(); }
    else setError(true);
  }, []);

  const read = () =>
    fetch("/api/private", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

  /** A deliberate re-read, with the button showing it's working. */
  const refresh = useCallback(() => {
    setRefreshing(true);
    read().then(apply).catch(() => setError(true)).finally(() => setRefreshing(false));
  }, [apply]);

  useEffect(() => {
    let alive = true;
    read().then((d) => { if (alive) apply(d); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [apply]);

  // Coming back to the tab after a while is the natural moment to re-read the
  // book — the server clock may have turned a quarter while you were away.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastLoad.current < 60_000) return;
      read().then(apply).catch(() => {});
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [apply]);

  const totals = data?.totals;
  const hasBook = (data?.commitments.length ?? 0) > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6">
      {/* ---------------------------------------------------------- masthead */}
      <header className="rise-in relative isolate mb-8 overflow-hidden">
        <span aria-hidden className="ghost pointer-events-none absolute -left-1 -top-4 select-none text-[20vw] leading-none sm:text-[8rem]">
          PRIVATE
        </span>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <p className="kicker mb-2">Alternatives</p>
            <h1 className="display text-4xl text-ink-1 md:text-5xl">Private Markets</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              You do not buy a share here. You <span className="text-ink-1">commit</span> capital to a fund, and a
              manager calls it down over years as they find things to buy — returning it, eventually, as those
              investments are sold. Committing moves no money. Only calls do.
            </p>
          </div>
          {hasBook && totals && (
            <div className="raised edge-gold shrink-0 px-6 py-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-ink-4">Total value / paid-in</p>
              <p className="tnum lumina mt-1 text-5xl font-bold leading-none text-gold">
                {multiple(totals.tvpi, totals.called)}
              </p>
              <p className="tnum mt-1.5 text-xs text-ink-3">
                on {money(totals.called)} called of {money(totals.committed)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------- the mechanics, once */}
      <section className="rise-in mb-8 grid gap-px overflow-hidden rounded-[14px] border border-hairline bg-hairline sm:grid-cols-3"
        style={{ "--i": 1 } as CSSProperties} aria-label="How a fund commitment works">
        {[
          ["01", "Commit", "You sign for an amount. No cash moves. It is an obligation you now carry, not a position you now own."],
          ["02", "Get called", "The manager draws the money down in pieces, on their schedule. Each call takes real cash from your account."],
          ["03", "Get distributed", "Years later, exits land and cash comes back. Fees hit first, value compounds last — that dip is the J-curve."],
        ].map(([n, title, body]) => (
          <div key={n} className="bg-bg1 p-5">
            <p className="tnum text-[10px] tracking-[0.2em] text-gold">{n}</p>
            <p className="mt-2 text-[13px] font-semibold text-ink-1">{title}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{body}</p>
          </div>
        ))}
      </section>

      {error && (
        <p className="mb-8 rounded-[10px] border border-hairline px-4 py-3 text-sm text-ink-3">
          Couldn&apos;t load the allocator&apos;s book.{" "}
          <button onClick={refresh} className="text-gold underline">Retry</button>
        </p>
      )}

      {!data && !error && (
        <div className="space-y-3">
          <div className="skeleton h-28 rounded-[14px]" />
          <div className="skeleton h-56 rounded-[14px]" />
          <div className="skeleton h-56 rounded-[14px]" />
        </div>
      )}

      {data && (
        <div className="space-y-10">
          {hasBook && totals && (
            <div className="rise-in" style={{ "--i": 2 } as CSSProperties}>
              <PortfolioSummary totals={totals} equity={data.equity} commitments={data.commitments.length} />
            </div>
          )}

          {/* ------------------------------------------------- your commitments */}
          {hasBook && (
            <section aria-labelledby="commitments-heading" className="rise-in space-y-4" style={{ "--i": 3 } as CSSProperties}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="commitments-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
                  Your commitments
                </h2>
                <button
                  type="button" onClick={refresh} disabled={refreshing}
                  className="pressable rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-3 hover:text-ink-1 disabled:opacity-50"
                >
                  {refreshing ? "Reading the book…" : "Refresh"}
                </button>
              </div>
              <p className="max-w-3xl text-[12px] leading-relaxed text-ink-4">
                The clock here runs in quarters, not ticks — about one quarter an hour on the simulated calendar.
                Come back and the book will have moved.
              </p>
              <div className="space-y-4">
                {data.commitments.map((c) => (
                  <CommitmentCard key={c.id} c={c} flows={data.flows} />
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------------------------------- open funds */}
          <section aria-labelledby="funds-heading" className="rise-in space-y-4" style={{ "--i": 4 } as CSSProperties}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="funds-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
                Open funds
              </h2>
              {totals && (
                <p className="tnum text-[11px] text-ink-4">
                  {money(Math.max(0, data.equity - totals.unfunded))} of commitment capacity left
                </p>
              )}
            </div>
            {!hasBook && (
              <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
                Nothing committed yet. Six funds are open — six different shapes of the same curve. Credit calls
                slowly and pays interest almost immediately; venture calls hard, marks flat for years, and either
                returns nothing or returns everything. Pick one and watch what the fee drag does before the value
                arrives.
              </p>
            )}
            {data.funds.length === 0 ? (
              <p className="rounded-[10px] border border-hairline px-4 py-6 text-center text-sm text-ink-3">
                No funds are open for commitments right now.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.funds.map((f) => (
                  <FundCard
                    key={f.id}
                    fund={f}
                    equity={data.equity}
                    outstanding={totals?.unfunded ?? 0}
                    open={openFund === f.id}
                    onOpen={setOpenFund}
                    onCommitted={refresh}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* --------------------------------------------------------- the honesty */}
      <footer className="mt-12 border-t border-hairline pt-6">
        <p className="max-w-3xl text-[12px] leading-relaxed text-ink-4">
          <span className="sim-mark mr-2 inline-block align-middle">SIMULATION</span>
          This models the mechanics of private funds — commitments, capital calls, fee drag, carried interest,
          distributions, and the ratios allocators judge them by — on a compressed clock. Real funds lock your
          money up for a decade or more, are generally open only to accredited or institutional investors, report
          marks quarterly and slowly, and have no reliable secondary market if you change your mind. Nothing here
          is an offer, a recommendation, or a claim about what any strategy returns.
        </p>
      </footer>
    </main>
  );
}
