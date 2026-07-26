"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LearnLink from "@/components/academy/learn-link";
import OptionTicket from "./option-ticket";
import type { Position } from "@/components/trading/shared";

/*
  The option chain — calls on the left, strikes down the spine, puts on the
  right, exactly the way a desk reads one. Rows run low strike to high; the
  live spot price is drawn as a line between the two strikes that straddle it,
  and the nearest strike is badged ATM. In-the-money quotes get a tint on their
  own side only, so moneyness is legible without reading a single number.

  Honesty rules this panel:
  · Any null price renders an em dash — never a zero, never a guess.
  · `iv: null` means the solve failed (the quoted mid sits below intrinsic, as
    it does on deep in-the-money contracts). Those rows print "est" for IV and
    still show greeks, because the engine fills them at the chain's median
    volatility. They're marked as estimates, not passed off as solved.
  · theta is per day; vega and rho are per percentage point of volatility.

  Below md the two-sided grid is abandoned for a single-column list with a
  Calls|Puts toggle — cramming a 13-column chain onto a phone helps nobody.
*/

export type OptionGreeks = {
  price: number; delta: number; gamma: number; theta: number; vega: number; rho: number;
};

export type OptionRow = {
  symbol: string;
  underlying: string;
  expiry: string;
  type: "call" | "put";
  strike: number;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  /** null = implied vol could NOT be solved. Greeks may still be present (estimated). */
  iv: number | null;
  greeks: OptionGreeks | null;
  intrinsic: number;
  extrinsic: number | null;
  inTheMoney: boolean;
};

type ChainResponse = {
  ok: boolean;
  symbol?: string;
  spot?: number;
  expiries?: string[];
  expiry?: string | null;
  asOf?: number;
  rows?: OptionRow[];
  error?: string;
};

const DASH = "—";

const px2 = (v: number | null | undefined) => (v == null ? DASH : v.toFixed(2));

function compact(v: number | null | undefined): string {
  if (v == null) return DASH;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

/** IV as a percent, or "est" when the solve failed but greeks were estimated. */
function ivText(row: OptionRow | undefined): string {
  if (!row) return DASH;
  if (row.iv != null) return `${(row.iv * 100).toFixed(1)}`;
  return row.greeks ? "est" : DASH;
}

const isEstimated = (row: OptionRow | undefined) => !!row && row.iv == null && row.greeks != null;

function dte(expiry: string): number {
  return Math.max(0, Math.ceil((new Date(`${expiry}T20:00:00Z`).getTime() - Date.now()) / 86_400_000));
}

function shortDate(expiry: string): string {
  const [y, m, d] = expiry.split("-").map(Number);
  if (!y || !m || !d) return expiry;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

// The two sides share one grid so the header and every row line up. Volume and
// open interest are the first to go when the viewport narrows.
const SIDE_GRID = "grid grid-cols-4 items-center gap-x-1.5 px-2 lg:grid-cols-6";
const WIDE = "hidden lg:block";

type StrikeRow = { strike: number; call?: OptionRow; put?: OptionRow };

export default function OptionChain({
  symbol, positions, marketOpen, buyingPower, cash, onPlaced,
}: {
  symbol: string;
  positions: Position[];
  marketOpen: boolean | null;
  buyingPower: number | null;
  cash: number;
  /** The page's account+positions reload — reused so a fill updates everything. */
  onPlaced: () => void;
}) {
  const [expiry, setExpiry] = useState<string | null>(null);
  const [data, setData] = useState<ChainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [phoneSide, setPhoneSide] = useState<"call" | "put">("call");

  // A different underlying is a different chain: the parent mounts this with
  // key={symbol}, so state starts clean rather than being reset in an effect.
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const qs = new URLSearchParams({ symbol });
        if (expiry) qs.set("expiry", expiry);
        const res = await fetch(`/api/market/options?${qs}`);
        const body = (await res.json()) as ChainResponse;
        if (!alive) return;
        if (body.ok) setData(body);
        else setError(body.error ?? "Couldn't load the option chain.");
      } catch {
        if (alive) setError("Couldn't reach the data service. Check your connection.");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol, expiry, nonce]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const spot = data?.spot ?? null;

  const strikes = useMemo<StrikeRow[]>(() => {
    const m = new Map<number, StrikeRow>();
    for (const r of rows) {
      const entry = m.get(r.strike) ?? { strike: r.strike };
      if (r.type === "call") entry.call = r; else entry.put = r;
      m.set(r.strike, entry);
    }
    return [...m.values()].sort((a, b) => a.strike - b.strike);
  }, [rows]);

  // The strike closest to spot — the chain's centre of gravity.
  const atmStrike = useMemo(() => {
    if (spot == null || !strikes.length) return null;
    return strikes.reduce((best, s) =>
      Math.abs(s.strike - spot) < Math.abs(best - spot) ? s.strike : best, strikes[0].strike);
  }, [strikes, spot]);

  const heldBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.symbol, p.qty);
    return m;
  }, [positions]);

  const selected = useMemo(
    () => rows.find((r) => r.symbol === selectedSymbol) ?? null,
    [rows, selectedSymbol],
  );

  const select = useCallback((row: OptionRow | undefined) => {
    if (!row) return;
    setSelectedSymbol((cur) => (cur === row.symbol ? null : row.symbol));
  }, []);

  const expiries = data?.expiries ?? [];
  const activeExpiry = data?.expiry ?? expiry;
  const hasChain = strikes.length > 0;

  // ------------------------------------------------------------- chrome bits

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-3.5 md:px-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Option chain</h2>
        <LearnLink concept="options" />
      </div>
      <div className="flex items-center gap-3">
        {spot != null && (
          <span className="tnum text-[11px] text-ink-4">Spot {spot.toFixed(2)}</span>
        )}
        {data?.asOf != null && (
          <span className="tnum text-[11px] text-ink-4">
            as of {new Date(data.asOf).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button onClick={() => setNonce((n) => n + 1)} disabled={busy}
          className="pressable min-h-11 rounded-full border border-hairline px-3 text-[11px] text-ink-3 hover:text-ink-1 disabled:opacity-50">
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
    </div>
  );

  const expiryStrip = expiries.length > 0 && (
    <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:px-5 [&::-webkit-scrollbar]:hidden"
      role="tablist" aria-label="Expiry">
      {expiries.map((e) => {
        const active = e === activeExpiry;
        return (
          <button key={e} role="tab" aria-selected={active}
            onClick={() => { setExpiry(e); setSelectedSymbol(null); }}
            className={`pressable tnum min-h-11 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[11px] transition-colors ${
              active
                ? "border-gold/45 bg-gold/10 text-gold"
                : "border-hairline text-ink-3 hover:border-hairline hover:text-ink-1"
            }`}>
            {shortDate(e)} <span className={active ? "text-gold/70" : "text-ink-4"}>· {dte(e)}d</span>
          </button>
        );
      })}
    </div>
  );

  // ------------------------------------------------------------------ states

  if (error) {
    return (
      <div className="px-4 py-10 text-center md:px-5">
        <p className="text-sm text-ink-2">{error}</p>
        <button onClick={() => setNonce((n) => n + 1)}
          className="pressable mt-3 min-h-11 rounded-full border border-hairline px-5 text-xs text-ink-2 hover:text-ink-1">
          Retry
        </button>
      </div>
    );
  }

  if (busy && !data) {
    return (
      <div className="px-4 py-4 md:px-5">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton h-8 w-24 rounded-full" />)}
        </div>
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 9 }).map((_, i) => <span key={i} className="skeleton block h-8 w-full" />)}
        </div>
        <span className="sr-only">Loading the option chain…</span>
      </div>
    );
  }

  if (!expiries.length || !hasChain) {
    return (
      <div>
        {header}
        <p className="px-4 py-10 text-center text-xs text-ink-4 md:px-5">
          {expiries.length
            ? `No contracts quoted for ${symbol} on this expiry.`
            : `No listed options for ${symbol}.`}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- the desk

  const ticket = selected ? (
    <OptionTicket
      key={selected.symbol}
      row={selected}
      spot={spot}
      held={heldBy.get(selected.symbol) ?? 0}
      marketOpen={marketOpen}
      buyingPower={buyingPower}
      cash={cash}
      onPlaced={onPlaced}
      onDismiss={() => setSelectedSymbol(null)}
    />
  ) : (
    <div className="panel hidden p-4 lg:block">
      <p className="text-xs text-ink-3">Select a strike to trade it.</p>
      <p className="mt-1.5 text-[11px] text-ink-4">
        Long only here: buy to open, sell to close. Writing contracts isn&apos;t supported.
      </p>
    </div>
  );

  return (
    <div>
      {header}
      {expiryStrip}

      <div className={`mt-2 grid gap-4 px-4 pb-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_320px] ${busy ? "opacity-60" : ""}`}>
        {/* the ticket leads on a phone (it's what you just tapped), rails on desktop */}
        <div className="order-first min-w-0 lg:order-last">{ticket}</div>

        <div className="order-last min-w-0 lg:order-first">
          {/* ---------- phone: one side at a time ---------- */}
          <div className="md:hidden">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-bg2 p-1">
              {(["call", "put"] as const).map((s) => (
                <button key={s} onClick={() => setPhoneSide(s)} aria-pressed={phoneSide === s}
                  className={`pressable min-h-11 rounded-[9px] text-xs font-semibold transition-colors ${
                    phoneSide === s ? "bg-bg3 text-ink-1" : "text-ink-3"
                  }`}>
                  {s === "call" ? "Calls" : "Puts"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">
              <span className="w-[68px] shrink-0">Strike</span>
              <span className="flex-1">Bid / Ask</span>
              <span className="w-10 text-right">IV%</span>
              <span className="w-10 text-right">Delta</span>
            </div>
            <ul className="divide-y divide-[var(--hairline)] rounded-xl border border-hairline">
              {strikes.map(({ strike, call, put }) => {
                const row = phoneSide === "call" ? call : put;
                const atm = strike === atmStrike;
                const held = row ? heldBy.get(row.symbol) ?? 0 : 0;
                return (
                  <li key={strike}>
                    <button
                      onClick={() => select(row)}
                      disabled={!row}
                      aria-pressed={!!row && row.symbol === selectedSymbol}
                      className={`relative flex min-h-[48px] w-full items-center gap-2 px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                        row?.symbol === selectedSymbol ? "bg-gold/10" : row?.inTheMoney ? "bg-bg2" : ""
                      }`}>
                      <span className={`tnum w-[68px] shrink-0 text-[13px] ${atm ? "font-semibold text-gold" : "text-ink-1"}`}>
                        {strike}
                        {atm && <span className="ml-1 font-mono text-[8px] uppercase tracking-[0.14em] text-gold">atm</span>}
                      </span>
                      <span className="tnum flex-1 whitespace-nowrap text-[11px] text-ink-2">
                        {px2(row?.bid)} <span className="text-ink-4">/</span> {px2(row?.ask)}
                      </span>
                      <span className={`tnum w-10 text-right text-[11px] ${isEstimated(row) ? "text-ink-3" : "text-ink-2"}`}>
                        {ivText(row)}
                      </span>
                      <span className="tnum w-10 text-right text-[11px] text-ink-2">
                        {row?.greeks ? row.greeks.delta.toFixed(2) : DASH}
                      </span>
                      {held > 0 && (
                        <span className="absolute inset-y-1.5 left-0.5 w-[3px] rounded-full bg-gold/70"
                          title={`You hold ${held}`} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ---------- desk: calls · strike · puts ---------- */}
          <div className="hidden overflow-x-auto rounded-xl border border-hairline md:block">
            <table className="w-full min-w-[640px] table-fixed border-collapse lg:min-w-[820px]">
              <caption className="sr-only">
                {symbol} option chain for {activeExpiry}. Calls on the left, puts on the right, strikes down the centre.
              </caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="w-[calc((100%-92px)/2)] px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.18em] text-gain">
                    Calls
                  </th>
                  <th scope="col" className="w-[92px] py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">
                    Strike
                  </th>
                  <th scope="col" className="w-[calc((100%-92px)/2)] px-2 py-1.5 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-loss">
                    Puts
                  </th>
                </tr>
                <tr className="border-b border-hairline">
                  <th scope="col" className="p-0 font-normal">
                    <div className={`${SIDE_GRID} py-1 text-right font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4`}>
                      <span className={WIDE}>Vol</span>
                      <span className={WIDE}>OI</span>
                      <span>Delta</span><span>IV%</span><span>Bid</span><span>Ask</span>
                    </div>
                  </th>
                  <th scope="col" className="p-0" />
                  <th scope="col" className="p-0 font-normal">
                    <div className={`${SIDE_GRID} py-1 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-ink-4`}>
                      <span>Bid</span><span>Ask</span><span>IV%</span><span>Delta</span>
                      <span className={WIDE}>OI</span>
                      <span className={WIDE}>Vol</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {strikes.map(({ strike, call, put }, i) => {
                  const prev = strikes[i - 1];
                  const crossesSpot = spot != null && strike >= spot && (i === 0 || prev.strike < spot);
                  const atm = strike === atmStrike;
                  return (
                    <ChainRowGroup key={strike}
                      strike={strike} call={call} put={put} atm={atm}
                      spotLine={crossesSpot ? spot : null}
                      selectedSymbol={selectedSymbol}
                      heldBy={heldBy}
                      onSelect={select} />
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
            Bid and ask are per share; one contract covers 100 shares. Delta is per $1 of the
            underlying, theta is per day, and vega is per one percentage point of implied
            volatility. <span className="tnum">est</span> in the IV column means implied volatility
            couldn&apos;t be solved from the quoted mid — usually a deep in-the-money contract quoted
            below intrinsic — so the greeks on that row are estimated at the chain&apos;s median
            volatility rather than solved. A dash means the number isn&apos;t available.
          </p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- a row

function ChainRowGroup({
  strike, call, put, atm, spotLine, selectedSymbol, heldBy, onSelect,
}: {
  strike: number;
  call?: OptionRow;
  put?: OptionRow;
  atm: boolean;
  /** Non-null on the first strike at or above spot — draws the price line above it. */
  spotLine: number | null;
  selectedSymbol: string | null;
  heldBy: Map<string, number>;
  onSelect: (row: OptionRow | undefined) => void;
}) {
  return (
    <>
      {spotLine != null && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="relative flex h-5 items-center">
              <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-gold/45" />
              <span className="tnum relative mx-auto rounded-full border border-gold/40 bg-bg1 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-gold">
                Spot {spotLine.toFixed(2)}
              </span>
            </div>
          </td>
        </tr>
      )}
      <tr className="border-b border-hairline last:border-0">
        <td className="p-0">
          <SideCell row={call} align="right" selected={call?.symbol === selectedSymbol}
            held={call ? heldBy.get(call.symbol) ?? 0 : 0} onSelect={onSelect} />
        </td>
        <td className={`text-center align-middle ${atm ? "bg-gold/10" : ""}`}>
          <span className={`tnum text-[13px] ${atm ? "font-semibold text-gold" : "text-ink-1"}`}>
            {strike}
          </span>
          {atm && (
            <span className="block font-mono text-[8px] uppercase tracking-[0.16em] text-gold/80">atm</span>
          )}
        </td>
        <td className="p-0">
          <SideCell row={put} align="left" selected={put?.symbol === selectedSymbol}
            held={put ? heldBy.get(put.symbol) ?? 0 : 0} onSelect={onSelect} />
        </td>
      </tr>
    </>
  );
}

function SideCell({ row, align, selected, held, onSelect }: {
  row?: OptionRow;
  align: "left" | "right";
  selected: boolean;
  held: number;
  onSelect: (row: OptionRow | undefined) => void;
}) {
  if (!row) {
    return <div className={`${SIDE_GRID} min-h-9 py-1.5 text-[12px] text-ink-4`}><span>{DASH}</span></div>;
  }

  const est = isEstimated(row);
  const vol = <span key="vol" className={`${WIDE} tnum text-ink-3`}>{compact(row.volume)}</span>;
  const oi = <span key="oi" className={`${WIDE} tnum text-ink-3`}>{compact(row.openInterest)}</span>;
  const delta = (
    <span key="delta" className={`tnum ${est ? "text-ink-3" : "text-ink-2"}`}>
      {row.greeks ? row.greeks.delta.toFixed(2) : DASH}
    </span>
  );
  const iv = (
    <span key="iv" className={`tnum ${est ? "italic text-ink-3" : "text-ink-2"}`}
      title={est ? "Implied volatility couldn't be solved — greeks are estimated at the chain's median volatility." : undefined}>
      {ivText(row)}
    </span>
  );
  const bid = <span key="bid" className="tnum text-ink-1">{px2(row.bid)}</span>;
  const ask = <span key="ask" className="tnum text-ink-1">{px2(row.ask)}</span>;

  // Mirrored: on calls the quote sits against the spine, on puts it leads.
  const cells = align === "right"
    ? [vol, oi, delta, iv, bid, ask]
    : [bid, ask, iv, delta, oi, vol];

  return (
    <button
      onClick={() => onSelect(row)}
      aria-pressed={selected}
      aria-label={`${row.type === "call" ? "Call" : "Put"} ${row.strike}, bid ${row.bid ?? "unavailable"}, ask ${row.ask ?? "unavailable"}${
        est ? ", implied volatility unsolved, greeks estimated" : ""}${held > 0 ? `, you hold ${held}` : ""}`}
      className={`${SIDE_GRID} relative min-h-9 w-full py-1.5 text-[12px] transition-colors ${
        align === "right" ? "text-right" : "text-left"
      } ${
        selected
          ? "bg-gold/15 ring-1 ring-inset ring-gold/40"
          : row.inTheMoney ? "bg-bg2 hover:bg-bg3" : "hover:bg-bg2"
      }`}>
      {cells}
      {/* your inventory, drawn on the outer edge of the row */}
      {held > 0 && (
        <span aria-hidden
          className={`absolute inset-y-1 w-[3px] rounded-full bg-gold/70 ${align === "right" ? "left-0.5" : "right-0.5"}`} />
      )}
    </button>
  );
}
