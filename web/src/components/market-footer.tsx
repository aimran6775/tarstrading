"use client";

/*
  The footer ticker — the bottom strip of the terminal, present on every
  authenticated screen. A continuously scrolling tape of quotes across EVERY
  venue the platform trades, a lane filter popover, a sub-second world clock,
  and the SIMULATED mark (paper state must always be in view).

  Three properties make it feel like an instrument rather than a gif:

  1. It reads the live board. The old tape composed from a hardcoded symbol
     dictionary, so FX, futures, indices and the world sections simply never
     appeared — the strip advertised a fraction of the tradeable universe.
     `/api/market/board?tape=1` serves the head of every category from the
     same server cache the Markets page uses.

  2. Constant pixel speed. A fixed 42s loop meant the tape's speed depended
     on how many symbols were on it — sluggish with few, frantic with many.
     The loop's duration is now derived from the measured width of one copy,
     so the glide is the same at 8 symbols or 30.

  3. Ticks are visible. When a price changes between polls, the price flashes
     once in the direction of the move — the tape shows the market breathing
     instead of silently swapping numbers.

  The clock ticks on requestAnimationFrame but writes straight to the DOM via
  refs, so it never re-renders the tape.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { displaySymbol, formatPrice } from "@/components/trading/shared";

/* ---------------------------------------------------------------- types */

type TapeRow = {
  symbol: string;
  price: number;
  changePercent: number | null; // fraction, e.g. 0.0123
  category: string | null;
};

/* Every venue is a lane; the tape round-robins the enabled ones so it stays
   a cross-section of the whole market, never 30 mega-caps in a row. */
const LANES = [
  { key: "indices", label: "Indices", cat: "Indices" },
  { key: "stocks", label: "Stocks", cat: "Stocks" },
  { key: "etfs", label: "ETFs", cat: "ETFs" },
  { key: "crypto", label: "Crypto", cat: "Crypto" },
  { key: "global", label: "Global", cat: "Global" },
  { key: "fx", label: "FX", cat: "FX" },
  { key: "income", label: "Income", cat: "Income" },
  { key: "futures", label: "Futures", cat: "Futures" },
] as const;
type LaneKey = (typeof LANES)[number]["key"] | "watchlist";
type Filters = Record<LaneKey, boolean>;

const DEFAULT_FILTERS: Filters = {
  indices: true, stocks: true, etfs: true, crypto: true,
  global: true, fx: true, income: true, futures: true, watchlist: false,
};

/* v2: the v1 key stored {stocks,etfs,crypto,watchlist} — a different shape.
   A fresh key beats migrating a preference nobody set deliberately. */
const FILTER_KEY = "tars-ticker-filter-v2";
const CLOCK_KEY = "tars-clock-city";
const MAX_TAPE = 30;
const POLL_MS = 20_000;
/* The glide: how many pixels of tape pass a fixed point per second. */
const SPEED_PX_S = 46;

/** Round-robin the enabled lanes so the tape interleaves venues. */
function composeRows(filters: Filters, byLane: Map<string, TapeRow[]>, watch: TapeRow[]): TapeRow[] {
  const out: TapeRow[] = [];
  const seen = new Set<string>();
  const push = (r: TapeRow) => {
    if (out.length < MAX_TAPE && !seen.has(r.symbol)) { seen.add(r.symbol); out.push(r); }
  };
  if (filters.watchlist) for (const r of watch) push(r);
  const lanes = LANES.filter((l) => filters[l.key]).map((l) => byLane.get(l.cat) ?? []);
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

function fmtChange(frac: number | null): string {
  if (frac == null) return "· ·";
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
    so the tape never repaints because time passed. */
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

/** One quote on the tape. Watches its own price between polls and flashes
    once in the direction of the tick — state is local, so a flash re-renders
    one item, never the strip. */
function TapeItem({ row }: { row: TapeRow }) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(row.price);

  useEffect(() => {
    if (row.price === prev.current) return;
    const dir = row.price > prev.current ? "up" : "down";
    prev.current = row.price;
    setFlash(dir);
    const id = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(id);
  }, [row.price]);

  const up = (row.changePercent ?? 0) >= 0;
  return (
    <Link
      href={`/app/m/${encodeURIComponent(row.symbol)}`}
      className="group/tape-item mx-1 flex h-full shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[11px] no-underline transition-colors hover:bg-bg2"
    >
      <span className="font-mono tracking-wide text-ink-2 transition-colors group-hover/tape-item:text-ink-1">
        {displaySymbol(row.symbol)}
      </span>
      <span className={`tnum text-ink-1 ${flash === "up" ? "tick-up" : flash === "down" ? "tick-down" : ""}`}>
        {formatPrice(row.symbol, row.price)}
      </span>
      <span className={`tnum ${row.changePercent == null ? "text-ink-4" : up ? "text-gain" : "text-loss"}`}>
        {fmtChange(row.changePercent)}
      </span>
    </Link>
  );
}

function TapeItems({ rows, hidden, measureRef }: {
  rows: TapeRow[];
  hidden?: boolean;
  measureRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={measureRef}
      className={`flex h-full items-center ${hidden ? "motion-reduce:hidden" : ""}`}
      aria-hidden={hidden || undefined}
    >
      {rows.map((r) => <TapeItem key={r.symbol} row={r} />)}
    </div>
  );
}

/* ------------------------------------------------------------ the footer */

export function MarketFooter() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loaded, setLoaded] = useState(false);
  const [byLane, setByLane] = useState<Map<string, TapeRow[]>>(new Map());
  const [watchRows, setWatchRows] = useState<TapeRow[]>([]);
  const { open, setOpen, rootRef } = usePopover();

  /*
    Constant glide (property 2). One copy of the tape is measured; the loop
    travels exactly one copy-width per cycle, so duration = width / speed.
    Quantised to 4s steps: re-timing a running CSS animation makes it jump,
    so tiny width changes from a price gaining a digit must not re-time it.
  */
  const copyRef = useRef<HTMLDivElement>(null);
  const [durS, setDurS] = useState(40);
  useEffect(() => {
    const el = copyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      if (!w) return;
      const raw = Math.max(20, w / SPEED_PX_S);
      setDurS(Math.round(raw / 4) * 4);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hydrate filter prefs after mount — SSR and first client paint agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Filters>;
        setFilters((d) => {
          const next = { ...d };
          for (const k of Object.keys(next) as LaneKey[]) if (typeof p[k] === "boolean") next[k] = p[k]!;
          return next;
        });
      }
    } catch { /* corrupted or unavailable — defaults are fine */ }
    setLoaded(true);
  }, []);

  const toggle = useCallback((key: LaneKey) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(FILTER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // The whole market, one small poll (property 1): every venue's head rows.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/market/board?tape=1");
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; rows?: TapeRow[] };
        if (cancelled || !data.ok || !Array.isArray(data.rows)) return;
        const lanes = new Map<string, TapeRow[]>();
        for (const r of data.rows) {
          if (!r.category) continue;
          const lane = lanes.get(r.category) ?? [];
          lane.push(r);
          lanes.set(r.category, lane);
        }
        setByLane(lanes);
      } catch { /* transient network failure — keep the last tape */ }
    };
    void load();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [loaded]);

  // The watchlist lane is only worth requests when it's switched on.
  useEffect(() => {
    if (!loaded || !filters.watchlist) return;
    let cancelled = false;
    const load = async () => {
      try {
        const acct = await fetch("/api/account").then((r) => (r.ok ? r.json() : null));
        const symbols: string[] = acct?.ok && Array.isArray(acct.watchlist) ? acct.watchlist.slice(0, 10) : [];
        if (!symbols.length || cancelled) { if (!cancelled) setWatchRows([]); return; }
        const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
        if (!res.ok) return;
        const data = await res.json() as { ok?: boolean; quotes?: { symbol: string; price: number; changePercent: number }[] };
        if (cancelled || !data.ok || !Array.isArray(data.quotes)) return;
        setWatchRows(data.quotes.map((q) => ({
          symbol: q.symbol, price: q.price, changePercent: q.changePercent, category: null,
        })));
      } catch { /* tape degrades to the board lanes */ }
    };
    void load();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [loaded, filters.watchlist]);

  const rows = useMemo(
    () => composeRows(filters, byLane, watchRows),
    [filters, byLane, watchRows]);

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

      {/* The tape: two copies, translateX(-50%) loop, duration derived from
          measured width so the glide never changes with symbol count. Hover or
          keyboard focus pauses it; under reduced motion it's a still strip you
          scroll by hand (the duplicate copy hides so nothing repeats). */}
      <div
        className="relative h-full flex-1 overflow-hidden motion-reduce:overflow-x-auto"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)",
        }}
      >
        {rows.length ? (
          <div className="tape flex h-full w-max items-center" style={{ animationDuration: `${durS}s` }}>
            <TapeItems rows={rows} measureRef={copyRef} />
            <TapeItems rows={rows} hidden />
          </div>
        ) : (
          <div className="flex h-full items-center px-2 text-[11px] text-ink-4">
            {loaded ? "Tape is empty — pick a lane in the filter." : "Reading the tape…"}
          </div>
        )}
      </div>

      {/* Lane filters — every venue the platform trades, plus your watchlist. */}
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ticker lanes"
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
            {[...LANES.map((l) => ({ key: l.key as LaneKey, label: l.label })),
              { key: "watchlist" as LaneKey, label: "My watchlist" }].map(({ key, label }) => (
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
