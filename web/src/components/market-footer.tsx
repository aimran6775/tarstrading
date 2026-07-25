"use client";

/*
  The footer ticker — the bottom strip of the terminal, present on every
  authenticated screen. A continuously scrolling tape of live-ish quotes,
  a category filter popover, a sub-second world clock, and the SIMULATED
  mark (relocated from the header — paper state must always be in view).

  The tape polls /api/market/quotes every 20s for at most 14 symbols; the
  clock ticks on requestAnimationFrame but writes straight to the DOM via
  refs, so it never re-renders the tape.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { SYMBOLS } from "@/lib/symbols";

/* ---------------------------------------------------------------- types */

type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: number; // fraction, e.g. 0.0123
  asOf: number;
};

type Filters = { stocks: boolean; etfs: boolean; crypto: boolean; watchlist: boolean };

const FILTER_KEY = "tars-ticker-filter";
const CLOCK_KEY = "tars-clock-city";
const DEFAULT_FILTERS: Filters = { stocks: true, etfs: true, crypto: true, watchlist: false };
const MAX_TAPE = 14;
const POLL_MS = 20_000;

/* ------------------------------------------------------- classification */

const ETF_SET = new Set([
  "SPY", "QQQ", "IWM", "DIA", "VTI", "GLD", "SLV", "USO", "TLT", "ARKK",
  "SMH", "VOO", "SCHD", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "EEM",
  "EFA", "VNQ", "HYG", "AGG", "TQQQ", "SQQQ", "SOXL", "GDX", "BITO",
]);

type Category = "stocks" | "etfs" | "crypto";

function classify(symbol: string): Category {
  if (symbol.includes("/")) return "crypto";
  if (ETF_SET.has(symbol)) return "etfs";
  return "stocks";
}

const BY_CATEGORY: Record<Category, string[]> = { stocks: [], etfs: [], crypto: [] };
for (const { symbol } of SYMBOLS) BY_CATEGORY[classify(symbol)].push(symbol);

/** Compose the visible set: watchlist first, then round-robin the enabled
    categories so the tape stays a mix rather than 14 mega-cap stocks. */
function composeSymbols(filters: Filters, watchlist: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (out.length < MAX_TAPE && !seen.has(s)) { seen.add(s); out.push(s); }
  };
  if (filters.watchlist) for (const s of watchlist) push(s);
  const lanes = (["stocks", "etfs", "crypto"] as const)
    .filter((c) => filters[c]).map((c) => BY_CATEGORY[c]);
  for (let i = 0; out.length < MAX_TAPE && lanes.some((l) => i < l.length); i++) {
    for (const lane of lanes) if (i < lane.length) push(lane[i]);
  }
  return out;
}

/* ------------------------------------------------------------ the cities */

type City = { name: string; tz: string };

const CITIES: City[] = [
  { name: "New York", tz: "America/New_York" },
  { name: "Toronto", tz: "America/Toronto" },
  { name: "São Paulo", tz: "America/Sao_Paulo" },
  { name: "London", tz: "Europe/London" },
  { name: "Paris", tz: "Europe/Paris" },
  { name: "Frankfurt", tz: "Europe/Berlin" },
  { name: "Zurich", tz: "Europe/Zurich" },
  { name: "Dubai", tz: "Asia/Dubai" },
  { name: "Karachi", tz: "Asia/Karachi" },
  { name: "Mumbai", tz: "Asia/Kolkata" },
  { name: "Singapore", tz: "Asia/Singapore" },
  { name: "Hong Kong", tz: "Asia/Hong_Kong" },
  { name: "Shanghai", tz: "Asia/Shanghai" },
  { name: "Seoul", tz: "Asia/Seoul" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
  { name: "Sydney", tz: "Australia/Sydney" },
];

/** Best-effort city for the viewer's own timezone: a known city if the zone
    matches, otherwise the zone's last path segment ("Asia/Karachi" → Karachi). */
function localCity(): City {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const known = CITIES.find((c) => c.tz === tz);
    if (known) return known;
    const name = (tz.split("/").pop() ?? tz).replace(/_/g, " ");
    return { name, tz };
  } catch {
    return CITIES[0];
  }
}

/* ------------------------------------------------------------ formatting */

function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p >= 10_000) return p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return p.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtChange(frac: number): string {
  const pct = frac * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`;
}

/* -------------------------------------------------------------- popover */

/** Anchors a small panel above its trigger; closes on outside press/Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, rootRef };
}

const POPOVER_CLASS =
  "absolute bottom-full right-0 mb-2 min-w-44 rounded-xl border border-hairline bg-bg1 p-1.5 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.55)]";

/* ------------------------------------------------------------ the clock */

/** Sub-second world clock. requestAnimationFrame writes hh:mm:ss and the
    .mmmµµµ tail straight into two spans via refs — zero React re-renders,
    so the tape never repaints because time passed. The microsecond digits
    come from performance.now()'s fractional remainder: cosmetic precision,
    honest motion. */
function WorldClock() {
  const [city, setCity] = useState<City | null>(null);
  const { open, setOpen, rootRef } = usePopover();
  const hmsRef = useRef<HTMLSpanElement>(null);
  const subRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let initial = localCity();
    try {
      const stored = window.localStorage.getItem(CLOCK_KEY);
      const match = stored ? CITIES.find((c) => c.name === stored) : undefined;
      if (match) initial = match;
    } catch { /* storage unavailable — live with the local default */ }
    setCity(initial);
  }, []);

  const pick = useCallback((c: City) => {
    setCity(c);
    setOpen(false);
    try { window.localStorage.setItem(CLOCK_KEY, c.name); } catch { /* ignore */ }
  }, [setOpen]);

  useEffect(() => {
    if (!city) return;
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: city.tz, hour12: false,
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      fmt = new Intl.DateTimeFormat("en-GB", {
        hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    }
    let raf = 0;
    const tick = () => {
      const now = new Date();
      if (hmsRef.current) hmsRef.current.textContent = fmt.format(now);
      if (subRef.current) {
        const ms = String(now.getMilliseconds()).padStart(3, "0");
        const micro = String(Math.floor((performance.now() % 1) * 1000)).padStart(3, "0");
        subRef.current.textContent = `.${ms}${micro}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [city]);

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose world clock city"
        aria-expanded={open}
        className="pressable flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-ink-2 hover:text-ink-1"
      >
        <Icon.Globe className="h-3.5 w-3.5 text-ink-3" />
        <span className="hidden font-mono uppercase tracking-[0.14em] text-ink-2 md:inline">
          {city?.name ?? ""}
        </span>
        <span className="tnum text-ink-1">
          <span ref={hmsRef} />
          <span ref={subRef} className="hidden text-ink-3 sm:inline" />
        </span>
      </button>

      {open && (
        <div role="menu" aria-label="World clock city" className={`${POPOVER_CLASS} max-h-72 overflow-y-auto`}>
          {CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              role="menuitemradio"
              aria-checked={city?.name === c.name}
              onClick={() => pick(c)}
              className={`pressable flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-xs ${
                city?.name === c.name ? "bg-bg3 text-gold" : "text-ink-2 hover:bg-bg2 hover:text-ink-1"
              }`}
            >
              <span>{c.name}</span>
              <span className="tnum text-[10px] text-ink-4">
                {new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, hour12: false, hour: "2-digit", minute: "2-digit" }).format(new Date())}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the tape */

function TapeItems({ symbols, quotes, hidden }: {
  symbols: string[];
  quotes: Map<string, Quote>;
  hidden?: boolean;
}) {
  return (
    <div className="flex items-center" aria-hidden={hidden || undefined}>
      {symbols.map((sym) => {
        const q = quotes.get(sym);
        const up = (q?.changePercent ?? 0) >= 0;
        return (
          <span key={sym} className="mx-4 flex items-center gap-2 whitespace-nowrap text-[11px]">
            <span className="font-mono tracking-wide text-ink-2">{sym}</span>
            <span className="tnum text-ink-1">{q ? fmtPrice(q.price) : "—"}</span>
            <span className={`tnum ${q ? (up ? "text-gain" : "text-loss") : "text-ink-4"}`}>
              {q ? fmtChange(q.changePercent) : "· ·"}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const FILTER_ROWS: { key: keyof Filters; label: string }[] = [
  { key: "stocks", label: "Stocks" },
  { key: "etfs", label: "ETFs" },
  { key: "crypto", label: "Crypto" },
  { key: "watchlist", label: "My watchlist" },
];

/* ------------------------------------------------------------ the footer */

export function MarketFooter() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loaded, setLoaded] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const { open, setOpen, rootRef } = usePopover();

  // Hydrate filter prefs after mount — SSR and first client paint agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Filters>;
        setFilters({
          stocks: p.stocks ?? true, etfs: p.etfs ?? true,
          crypto: p.crypto ?? true, watchlist: p.watchlist ?? false,
        });
      }
    } catch { /* corrupted or unavailable — defaults are fine */ }
    setLoaded(true);
  }, []);

  const toggle = useCallback((key: keyof Filters) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(FILTER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // The watchlist is only worth a request when its filter is on.
  useEffect(() => {
    if (!loaded || !filters.watchlist) return;
    let cancelled = false;
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; watchlist?: string[] } | null) => {
        if (!cancelled && data?.ok && Array.isArray(data.watchlist)) setWatchlist(data.watchlist);
      })
      .catch(() => { /* tape degrades to curated symbols */ });
    return () => { cancelled = true; };
  }, [loaded, filters.watchlist]);

  const symbols = useMemo(() => composeSymbols(filters, watchlist), [filters, watchlist]);
  const symbolsKey = symbols.join(",");

  // Poll quotes for the visible set every 20s.
  useEffect(() => {
    if (!loaded || !symbolsKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbolsKey)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; quotes?: Quote[] };
        if (cancelled || !data.ok || !Array.isArray(data.quotes)) return;
        setQuotes((prev) => {
          const next = new Map(prev);
          for (const q of data.quotes!) next.set(q.symbol, q);
          return next;
        });
      } catch { /* transient network failure — keep the last tape */ }
    };
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [loaded, symbolsKey]);

  return (
    <footer
      className="glass fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-40 flex h-9 items-center gap-2 border-t border-hairline px-2 sm:bottom-0 sm:gap-3 sm:px-3"
      style={{ borderBottom: "none" }}
      aria-label="Market ticker"
    >
      {/* Paper-mode truth, always in view. Small, constant, never a banner.
          Opaque backing + z-10 so the tape can never read through or under it. */}
      <Link
        href="/disclosures"
        className="sim-mark pressable relative z-10 shrink-0 whitespace-nowrap bg-bg1 no-underline hover:border-gold/60"
        title="Simulated exchange — real prices, practice money. Read the disclosures."
      >
        SIMULATED
      </Link>

      {/* The tape: two copies of the row, translateX(-50%) loop (.tape),
          paused on hover, static under prefers-reduced-motion. */}
      <div
        className="relative h-full flex-1 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
        }}
      >
        {symbols.length ? (
          <div className="tape flex h-full w-max items-center">
            <TapeItems symbols={symbols} quotes={quotes} />
            <TapeItems symbols={symbols} quotes={quotes} hidden />
          </div>
        ) : (
          <div className="flex h-full items-center px-2 text-[11px] text-ink-4">
            Tape is empty — pick a category in the filter.
          </div>
        )}
      </div>

      {/* Tape filters */}
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ticker filters"
          aria-expanded={open}
          className={`pressable flex h-6 w-6 items-center justify-center rounded-md ${
            open ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
          }`}
        >
          <Icon.Sliders className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div className={POPOVER_CLASS}>
            <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              Tape shows
            </p>
            {FILTER_ROWS.map(({ key, label }) => (
              <label
                key={key}
                className="pressable flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-ink-2 hover:bg-bg2 hover:text-ink-1"
              >
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={() => toggle(key)}
                  className="h-3.5 w-3.5 accent-(--gold)"
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-(--hairline) sm:block" aria-hidden />

      <WorldClock />
    </footer>
  );
}
