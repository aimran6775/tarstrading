"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usd, pct, displaySymbol, marketHrefFor } from "@/components/trading/shared";

/*
  The Margin Desk — the page a prime broker never gives you.

  A real desk hands the client a requirement number and a shrug; the client's
  risk team reverse-engineers the rest. This page shows every input: what each
  position requires and under which regime, the SPAN credits by name (what the
  calendar spread saved, what long-S&P/short-Nasdaq earned), the live rates
  financing runs on, the margin-call clock when there is one, and a what-if
  box priced through the SAME function as the order gate — so the preview can
  never disagree with a rejection.

  Being able to recompute your own margin by hand is the product.
*/

type Risk = {
  equity: number; cash: number; longValue: number; shortValue: number;
  gross: number; net: number; maintenance: number; buyingPower: number;
  marginUsedPct: number; initialReq: number;
  span: {
    im: number; mm: number; naiveIm: number; naiveMm: number;
    intraCredit: number; interCredits: { group: string; credit: number }[];
  };
};
type Rates = { fedFunds: number; marginLoan: number; cashSweep: number; borrowGC: number };
type Row = { symbol: string; qty: number; regime: string; detail: string; naiveIm: number | null };
type Preview = {
  symbol: string; qty: number; imBefore: number; imAfter: number;
  delta: number; naiveDelta: number; creditVsNaive: number; affordable: boolean;
};
type Payload = {
  ok: boolean; risk: Risk; rates: Rates; positions: Row[];
  marginCall: { at: number; cureBy: number } | null;
  preview: Preview | null;
  conventions: { settlement: string; note: string };
};

const pctFmt = (r: number) => `${(r * 100).toFixed(2)}%`;

export default function MarginDesk() {
  const [data, setData] = useState<Payload | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [wSymbol, setWSymbol] = useState("");
  const [wQty, setWQty] = useState("1");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewNote, setPreviewNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/margin");
      if (!res.ok) { setPhase("error"); return; }
      const d = await res.json();
      if (!d.ok) { setPhase("error"); return; }
      setData(d);
      setPhase("ready");
    } catch { setPhase("error"); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // The what-if, debounced: half a second after you stop typing, priced.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const symbol = wSymbol.trim().toUpperCase();
    const qty = Number(wQty);
    if (!symbol || !Number.isFinite(qty) || qty === 0) { setPreview(null); setPreviewNote(""); return; }
    timer.current = setTimeout(async () => {
      try {
        const full = symbol.startsWith("FUT:") ? symbol : `FUT:${symbol}`;
        const res = await fetch(`/api/margin?symbol=${encodeURIComponent(full)}&qty=${qty}`);
        const d = await res.json();
        if (d.ok && d.preview) { setPreview(d.preview); setPreviewNote(""); }
        else { setPreview(null); setPreviewNote("Enter a live futures contract — e.g. ESU6, MNQU6, GCQ6."); }
      } catch { setPreviewNote("Couldn't price that — try again."); }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [wSymbol, wQty]);

  const risk = data?.risk;
  const spanSavings = risk ? risk.span.naiveIm - risk.span.im : 0;

  return (
    <main className="relative isolate mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-10 md:px-8 md:pb-10">
      <div className="aura aura-gold" aria-hidden />
      <div className="relative z-10 rise-in">
        <p className="kicker">The desk behind the desk</p>
        <h1 className="display mt-3 text-4xl text-ink-1 md:text-5xl">Margin Desk.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          Every number your requirement is built from — position by position,
          credit by credit, at the rates money actually costs today. You should
          be able to recompute your own margin by hand; this page is the proof.
        </p>
      </div>

      {phase === "error" && (
        <p className="relative z-10 mt-8 rounded-xl border border-loss/30 bg-loss/10 px-5 py-4 text-sm text-loss">
          Couldn&apos;t load the desk. Refresh to retry.
        </p>
      )}
      {phase === "loading" && <div className="skeleton relative z-10 mt-8 h-64" />}

      {phase === "ready" && data && risk && (
        <>
          {data.marginCall && (
            <MarginCallBanner cureBy={data.marginCall.cureBy} />
          )}

          {/* The headline numbers */}
          <section className="raised relative z-10 mt-8 grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Equity" value={usd(risk.equity, 0)} />
            <Stat label="Cash" value={usd(risk.cash, 0)} tone={risk.cash < 0 ? "loss" : undefined}
              sub={risk.cash < 0 ? "borrowing on margin" : undefined} />
            <Stat label="Initial req." value={usd(risk.initialReq, 0)} />
            <Stat label="Maintenance" value={usd(risk.maintenance, 0)} />
            <Stat label="Buying power" value={usd(risk.buyingPower, 0)} />
            <Stat label="Margin used" value={pct(risk.marginUsedPct).replace("+", "")}
              tone={risk.marginUsedPct > 0.8 ? "loss" : risk.marginUsedPct > 0.5 ? "warning" : undefined} />
          </section>

          {/* SPAN credits — what the portfolio saved by being a portfolio */}
          {risk.span.naiveIm > 0 && (
            <section className="raised relative z-10 mt-4 px-5 py-4">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                Futures — portfolio margin (SPAN)
              </h2>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <Stat label="Contract-by-contract" value={usd(risk.span.naiveIm, 0)} />
                <Stat label="As a portfolio" value={usd(risk.span.im, 0)} />
                {spanSavings > 0.5 && (
                  <Stat label="Credits earned" value={`−${usd(spanSavings, 0)}`} tone="gain" />
                )}
              </div>
              {(risk.span.intraCredit > 0.5 || risk.span.interCredits.length > 0) && (
                <ul className="mt-3 space-y-1 text-xs text-ink-3">
                  {risk.span.intraCredit > 0.5 && (
                    <li>
                      Calendar / micro-vs-full offsets: <span className="tnum text-gain">−{usd(risk.span.intraCredit, 0)}</span>
                      {" "}— opposing legs of the same product margin as a spread, not two outrights.
                    </li>
                  )}
                  {risk.span.interCredits.map((c) => (
                    <li key={c.group}>
                      {c.group} inter-commodity credit: <span className="tnum text-gain">−{usd(c.credit, 0)}</span>
                      {" "}— correlated products in opposite directions.
                    </li>
                  ))}
                </ul>
              )}
              {spanSavings <= 0.5 && (
                <p className="mt-2 text-xs text-ink-4">
                  No credits right now — every futures position points the same way.
                  Hedge one against another and the requirement falls; that&apos;s what this panel will show.
                </p>
              )}
            </section>
          )}

          {/* Financing — the price of money, live */}
          <section className="raised relative z-10 mt-4 px-5 py-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              Financing — accrued daily, actual/360
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Fed funds (live)" value={pctFmt(data.rates.fedFunds)} sub="FRED, daily" />
              <Stat label="Margin loan" value={pctFmt(data.rates.marginLoan)} sub="fed funds + 1.50%" />
              <Stat label="Idle cash earns" value={pctFmt(data.rates.cashSweep)} sub="fed funds − 0.50%" tone="gain" />
              <Stat label="Stock borrow" value={pctFmt(data.rates.borrowGC)} sub="general collateral" />
            </div>
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink-4">
              A leveraged position has to outrun its financing — that cost posts to your
              journal daily as a <Link href="/app/journal" className="text-gold underline decoration-dotted underline-offset-2">$CASH financing entry</Link>.
              And yes, idle cash earns a real rate here; the big houses sweep client cash at
              nearly nothing, which is one habit not worth simulating.
            </p>
          </section>

          {/* The what-if */}
          <section className="raised relative z-10 mt-4 px-5 py-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              What would it cost — futures what-if
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={wSymbol} onChange={(e) => setWSymbol(e.target.value)}
                placeholder="Contract — e.g. ESU6, GCQ6" aria-label="What-if contract"
                className="min-h-10 w-48 rounded-full border border-hairline bg-bg2 px-4 text-xs text-ink-1 outline-none focus:border-gold/50" />
              <input value={wQty} onChange={(e) => setWQty(e.target.value)} inputMode="numeric"
                placeholder="Qty (− for short)" aria-label="What-if quantity"
                className="min-h-10 w-32 rounded-full border border-hairline bg-bg2 px-4 text-xs text-ink-1 outline-none focus:border-gold/50" />
            </div>
            {previewNote && <p className="mt-2 text-xs text-ink-4">{previewNote}</p>}
            {preview && (
              <div className="mt-3 rounded-xl border border-hairline bg-bg2 px-4 py-3 text-sm">
                <p className="text-ink-1">
                  {preview.qty > 0 ? "Long" : "Short"} {Math.abs(preview.qty)} {displaySymbol(preview.symbol)}:{" "}
                  requirement {usd(preview.imBefore, 0)} → <span className="font-semibold">{usd(preview.imAfter, 0)}</span>
                  {" "}({preview.delta >= 0 ? "+" : "−"}{usd(Math.abs(preview.delta), 0)})
                </p>
                {preview.creditVsNaive > 0.5 && (
                  <p className="mt-1 text-xs text-gain">
                    {usd(preview.creditVsNaive, 0)} cheaper than margining it alone — it hedges your book.
                  </p>
                )}
                <p className={`mt-1 text-xs ${preview.affordable ? "text-ink-3" : "text-loss"}`}>
                  {preview.affordable
                    ? "Fits inside your equity — the desk would accept this."
                    : "Exceeds your equity — the desk would reject this order."}
                </p>
              </div>
            )}
          </section>

          {/* Per-position regimes */}
          <section className="raised relative z-10 mt-4 overflow-hidden">
            <h2 className="px-5 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              Position requirements
            </h2>
            {data.positions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-ink-3">
                No positions. Open one and its requirement appears here, itemised.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--hairline)]">
                {data.positions.map((p) => (
                  <li key={p.symbol} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                    <Link href={marketHrefFor(p.symbol)} className="pressable min-w-[110px] text-sm font-semibold text-ink-1 hover:text-gold">
                      {displaySymbol(p.symbol)}
                    </Link>
                    <span className="tnum text-xs text-ink-3">{p.qty > 0 ? `+${p.qty}` : p.qty}</span>
                    <span className="rounded-full bg-bg3 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                      {p.regime}
                    </span>
                    <span className="text-xs text-ink-4">{p.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Conventions — honest edges of the model */}
          <p className="relative z-10 mt-6 max-w-3xl text-xs leading-relaxed text-ink-4">
            {data.conventions.settlement} {data.conventions.note}
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: "gain" | "loss" | "warning";
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss"
    : tone === "warning" ? "text-warning" : "text-ink-1";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-4">{sub}</p>}
    </div>
  );
}

/** The cure clock — the two hours that matter most on any margin desk. */
function MarginCallBanner({ cureBy }: { cureBy: number }) {
  const [left, setLeft] = useState(cureBy - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(cureBy - Date.now()), 1000);
    return () => clearInterval(id);
  }, [cureBy]);
  const m = Math.max(0, Math.floor(left / 60_000));
  const s = Math.max(0, Math.floor((left % 60_000) / 1000));
  return (
    <div role="alert" className="relative z-10 mt-8 rounded-xl border border-loss/40 bg-loss/10 px-5 py-4">
      <p className="text-sm font-semibold text-loss">
        Margin call — {left > 0
          ? <>you have <span className="tnum">{m}:{String(s).padStart(2, "0")}</span> to cure it.</>
          : "the desk is now reducing your positions."}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">
        Close positions to bring equity back above maintenance and the call clears on the
        next mark. If the clock runs out, the desk liquidates for you — futures first
        (fastest margin relief), then the largest equity position.
      </p>
    </div>
  );
}
