"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
  The Markets control board — the operator's hands on the house universe.

  Every mutation is optimistic (the row moves the instant it's clicked) but
  never trusted: the API answer decides, a failure rolls the row back with an
  inline reason, and a success calls router.refresh() so the server component
  re-reads the vault and reconciles what we guessed. Nothing here fails
  silently — every fetch has a catch that surfaces.
*/

export type BoardRow = {
  symbol: string; category: string; rank: number; featured: number;
  enabled: number; note: string | null; addedAt: number; bars: number;
};

type Category = "stocks" | "etf" | "crypto";
const CATEGORIES: Category[] = ["stocks", "etf", "crypto"];
const ORDER: Record<string, number> = { stocks: 0, etf: 1, crypto: 2 };

// Dense on desktop, thumb-sized on phones — the console is used on both.
const TAP = "min-h-[44px] sm:min-h-0";
const CHIP = `pressable ${TAP} inline-flex items-center justify-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors disabled:opacity-40`;
const FIELD = `${TAP} rounded-lg border border-hairline bg-bg2 px-2 py-1 font-mono text-[11px] text-ink-1 outline-none focus:border-agent/60`;

/** One request, one honest answer — network faults become readable errors. */
async function send(url: string, init?: RequestInit): Promise<{ ok: boolean; error?: string; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.ok !== true) {
      return { ok: false, error: (data.error as string) ?? `HTTP ${res.status}`, data };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network unreachable.", data: {} };
  }
}

/** Coverage reads as health: nothing stored is a broken listing, not a stat. */
function coverage(bars: number): { tone: string; label: string } {
  if (bars === 0) return { tone: "text-loss", label: "cold" };
  if (bars < 120) return { tone: "text-gold", label: "thin" };
  return { tone: "text-gain", label: "warm" };
}

export default function MarketsBoard({ rows: served }: { rows: BoardRow[] }) {
  const router = useRouter();

  // Server data is the source of truth; local state only holds the optimistic
  // lead until the refreshed props land.
  const [rows, setRows] = useState<BoardRow[]>(served);
  useEffect(() => { setRows(served); }, [served]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const isBusy = (s: string) => busy.includes(s);
  const mark = (s: string, on: boolean) =>
    setBusy((b) => (on ? [...new Set([...b, s])] : b.filter((x) => x !== s)));
  const fail = (s: string, msg: string) => setErrors((e) => ({ ...e, [s]: msg }));
  const clear = (s: string) => setErrors((e) => {
    if (!(s in e)) return e;
    const next = { ...e }; delete next[s]; return next;
  });

  /** Edit one listing: optimistic, reverted on failure, refreshed on success. */
  async function edit(symbol: string, patch: Partial<BoardRow>) {
    const before = rows.find((r) => r.symbol === symbol);
    if (!before) return;
    clear(symbol);
    mark(symbol, true);
    setRows((rs) => rs.map((r) => (r.symbol === symbol ? { ...r, ...patch } : r)));

    const res = await send("/api/admin/markets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, ...patch }),
    });
    mark(symbol, false);
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.symbol === symbol ? before : r)));
      fail(symbol, res.error ?? "Edit failed.");
      return;
    }
    router.refresh();
  }

  /** Remove a listing — only ever reached through the confirm step. */
  async function remove(symbol: string) {
    const before = rows;
    clear(symbol);
    mark(symbol, true);
    setRows((rs) => rs.filter((r) => r.symbol !== symbol));

    const res = await send(`/api/admin/markets?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    mark(symbol, false);
    if (!res.ok) {
      setRows(before);
      fail(symbol, res.error ?? "Remove failed.");
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => cat === "all" || r.category === cat)
      .filter((r) => !s || r.symbol.toLowerCase().includes(s) || (r.note ?? "").toLowerCase().includes(s))
      .sort((a, b) =>
        (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9) ||
        a.rank - b.rank || a.symbol.localeCompare(b.symbol));
  }, [rows, q, cat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <>
      <AddSymbol rows={rows} onAdded={(row) => {
        setRows((rs) => (rs.some((r) => r.symbol === row.symbol) ? rs : [...rs, row]));
        router.refresh();
      }} />

      <GrowUniverse />

      {/* Board toolbar — filter, search, and the healing pass */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Board</h2>
        {(["all", ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
            className={`${CHIP} ${cat === c
              ? "border-agent/50 bg-agent/15 text-agent"
              : "border-hairline text-ink-4 hover:text-ink-2"}`}>
            {c}<span className="tnum ml-1.5 opacity-60">{counts[c] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter board…" aria-label="Filter the board"
            className={`${FIELD} w-40 placeholder:text-ink-4`} />
          <DeepHistory />
          <BackfillPass />
        </div>
      </div>

      <section className="panel mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">Symbol</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Rank</th>
              <th className="px-4 py-2.5">Featured</th>
              <th className="px-4 py-2.5">State</th>
              <th className="px-4 py-2.5 text-right">Coverage</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-4">
                {rows.length === 0
                  ? "The board is empty — the product falls back to its built-in defaults."
                  : "No listings match this filter."}
              </td></tr>
            )}
            {shown.map((r, i) => {
              const newGroup = i === 0 || shown[i - 1].category !== r.category;
              const cov = coverage(r.bars);
              const off = r.enabled !== 1;
              const err = errors[r.symbol];
              return (
                <Fragment key={r.symbol}>
                  {newGroup && (
                    <tr className="border-b border-hairline bg-bg2/60">
                      <td colSpan={7} className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">
                        {r.category}
                      </td>
                    </tr>
                  )}
                  <tr className={`border-b border-hairline last:border-0 transition-colors hover:bg-bg3/50 ${
                    isBusy(r.symbol) ? "opacity-60" : ""}`}>
                    {/* Symbol + note + any inline failure */}
                    <td className="px-4 py-2">
                      <p className={`font-mono text-xs font-medium ${off ? "text-ink-4" : "text-ink-1"}`}>{r.symbol}</p>
                      {r.note && <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-ink-4">{r.note}</p>}
                      {err && <p className="mt-0.5 text-[10px] text-loss">{err}</p>}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-2">
                      <select value={r.category} disabled={isBusy(r.symbol)}
                        aria-label={`Category for ${r.symbol}`}
                        onChange={(e) => edit(r.symbol, { category: e.target.value })}
                        className={`${FIELD} uppercase tracking-[0.1em]`}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        {!CATEGORIES.includes(r.category as Category) && <option value={r.category}>{r.category}</option>}
                      </select>
                    </td>

                    {/* Rank — commits on blur or Enter; keyed so server wins */}
                    <td className="px-4 py-2">
                      <input key={`${r.symbol}:${r.rank}`} type="number" defaultValue={r.rank}
                        min={0} max={9999} disabled={isBusy(r.symbol)}
                        aria-label={`Rank for ${r.symbol}`}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        onBlur={(e) => {
                          const n = Number(e.currentTarget.value);
                          if (!Number.isFinite(n) || n === r.rank) { e.currentTarget.value = String(r.rank); return; }
                          edit(r.symbol, { rank: Math.max(0, Math.min(9999, Math.round(n))) });
                        }}
                        className={`${FIELD} tnum w-16`} />
                    </td>

                    {/* Featured — gold is the attention color, used once here */}
                    <td className="px-4 py-2">
                      <button type="button" disabled={isBusy(r.symbol)} aria-pressed={r.featured === 1}
                        onClick={() => edit(r.symbol, { featured: r.featured === 1 ? 0 : 1 })}
                        className={`${CHIP} ${r.featured === 1
                          ? "border-gold/50 bg-gold/15 text-gold"
                          : "border-hairline text-ink-4 hover:text-ink-2"}`}>
                        {r.featured === 1 ? "featured" : "standard"}
                      </button>
                    </td>

                    {/* Enabled */}
                    <td className="px-4 py-2">
                      <button type="button" disabled={isBusy(r.symbol)} aria-pressed={!off}
                        onClick={() => edit(r.symbol, { enabled: off ? 1 : 0 })}
                        className={`${CHIP} ${off
                          ? "border-hairline text-ink-4 hover:text-ink-2"
                          : "border-[var(--hairline-strong)] text-ink-1"}`}>
                        {off ? "hidden" : "live"}
                      </button>
                    </td>

                    {/* Coverage */}
                    <td className="px-4 py-2 text-right">
                      <span className={`tnum text-xs ${cov.tone}`}>{r.bars.toLocaleString()}</span>
                      <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">{cov.label}</span>
                    </td>

                    {/* Remove — two steps, never one slip */}
                    <td className="px-4 py-2 text-right">
                      {confirming === r.symbol ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button type="button" disabled={isBusy(r.symbol)} onClick={() => remove(r.symbol)}
                            className={`${CHIP} border-loss/50 bg-loss/15 text-loss`}>confirm</button>
                          <button type="button" onClick={() => setConfirming(null)}
                            className={`${CHIP} border-hairline text-ink-4 hover:text-ink-2`}>keep</button>
                        </span>
                      ) : (
                        <button type="button" disabled={isBusy(r.symbol)} onClick={() => { clear(r.symbol); setConfirming(r.symbol); }}
                          className={`${CHIP} border-hairline text-ink-4 hover:border-loss/40 hover:text-loss`}>remove</button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
        {shown.length} shown · rank sorts the board, lower first · hidden listings keep their curation
      </p>
    </>
  );
}

/* ── Add symbol ────────────────────────────────────────────────────────── */

type Hit = { symbol: string; name: string };

/** Search the full ~13k directory, list it, and add the chosen one. */
function AddSymbol({ rows, onAdded }: { rows: BoardRow[]; onAdded: (row: BoardRow) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cat, setCat] = useState<"auto" | Category>("auto");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setError(""); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await send(`/api/symbols?q=${encodeURIComponent(term)}`);
      if (mine !== seq.current) return; // a newer keystroke already won
      if (!res.ok) { setHits([]); setError(res.error ?? "Symbol search failed."); return; }
      setError("");
      setHits(Array.isArray(res.data.results) ? (res.data.results as Hit[]) : []);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const listed = useMemo(() => new Set(rows.map((r) => r.symbol)), [rows]);

  async function add(symbol: string) {
    const category: Category = cat === "auto" ? (symbol.includes("/") ? "crypto" : "stocks") : cat;
    const rank = rows.length ? Math.max(...rows.map((r) => r.rank)) + 1 : 100;
    setPending(symbol);
    setError("");
    const res = await send("/api/admin/markets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, category, rank }),
    });
    setPending("");
    if (!res.ok) { setError(`${symbol}: ${res.error ?? "Add failed."}`); return; }
    onAdded({
      symbol, category, rank, featured: 0, enabled: 1,
      note: null, addedAt: Date.now(), bars: 0,
    });
    setQ(""); setHits([]);
  }

  return (
    <section className="raised mt-6 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Add listing</h2>
        <select value={cat} onChange={(e) => setCat(e.target.value as "auto" | Category)}
          aria-label="Category for the added symbol"
          className={`${FIELD} uppercase tracking-[0.1em]`}>
          <option value="auto">auto</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search the tradable universe — ticker or company name"
        aria-label="Search symbols to add"
        autoComplete="off"
        className={`${FIELD} mt-3 w-full py-2 text-xs placeholder:text-ink-4 sm:py-2`} />
      {error &&<p className="mt-2 font-mono text-[11px] text-loss">{error}</p>}

      {q.trim().length > 0 && (
        <ul className="mt-3 divide-y divide-hairline">
          {hits.length === 0 && !error && (
            <li className="py-2 font-mono text-[11px] text-ink-4">No match in the directory.</li>
          )}
          {hits.map((h) => {
            const already = listed.has(h.symbol);
            return (
              <li key={h.symbol} className="flex items-center gap-3 py-1.5">
                <span className="w-24 shrink-0 font-mono text-xs text-ink-1">{h.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-4">{h.name}</span>
                <button type="button" disabled={already || pending === h.symbol}
                  onClick={() => add(h.symbol)}
                  className={`${CHIP} shrink-0 ${already
                    ? "border-hairline text-ink-4"
                    : "border-agent/50 bg-agent/15 text-agent hover:bg-agent/25"}`}>
                  {already ? "listed" : pending === h.symbol ? "adding…" : "add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Grow the universe ─────────────────────────────────────────────────── */

const KINDS: { value: string; label: string }[] = [
  { value: "CS", label: "common stock" },
  { value: "ETF", label: "etf" },
  { value: "ADRC", label: "adr" },
  { value: "CRYPTO", label: "crypto pair" },
];
const COUNTS = [50, 100, 250, 500];

type Preview = {
  available: number;
  sample: { symbol: string; name: string }[];
  exchanges: { code: string; available: number }[];
};

/*
  Bulk listing. The board grows by hundreds here, not by ones: pick a slice of
  the 13k-row directory, read how many of those are NOT yet listed, and file
  that many at once. Add-only by construction — the endpoint cannot disable,
  edit or remove a listing, so the worst a wrong filter costs is a few rows to
  remove by hand.

  The count is previewed before anything is written, and the freshly added
  symbols land cold, so the fill button sits right there next to the result.
*/
function GrowUniverse() {
  const router = useRouter();

  const [kind, setKind] = useState("CS");
  const [exchange, setExchange] = useState("");
  const [count, setCount] = useState(100);
  const [cat, setCat] = useState<"auto" | Category>("auto");
  const [q, setQ] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ n: number; symbols: string[] } | null>(null);

  const [fill, setFill] = useState<"idle" | "running" | "done" | "error">("idle");
  const [fillNote, setFillNote] = useState("");

  const seq = useRef(0);
  const [stamp, setStamp] = useState(0); // bumped after a commit to re-count

  // Preview: debounced, last-keystroke-wins, and never silently empty — a
  // failure says so instead of reading as "0 available".
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ kind });
      if (exchange) params.set("exchange", exchange);
      if (q.trim()) params.set("search", q.trim());
      const res = await send(`/api/admin/markets/bulk?${params}`);
      if (mine !== seq.current) return;
      setLoading(false);
      if (!res.ok) { setPreview(null); setError(res.error ?? "Preview failed."); return; }
      setError("");
      setPreview({
        available: Number(res.data.available ?? 0),
        sample: Array.isArray(res.data.sample) ? (res.data.sample as Preview["sample"]) : [],
        exchanges: Array.isArray(res.data.exchanges) ? (res.data.exchanges as Preview["exchanges"]) : [],
      });
    }, 200);
    return () => clearTimeout(t);
  }, [kind, exchange, q, stamp]);

  const available = preview?.available ?? 0;
  const willAdd = Math.min(count, available);

  async function commit() {
    setAdding(true);
    setError("");
    setAdded(null);
    setFill("idle");
    setFillNote("");
    const res = await send("/api/admin/markets/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind, exchange: exchange || undefined, search: q.trim() || undefined,
        limit: count, category: cat === "auto" ? undefined : cat,
      }),
    });
    setAdding(false);
    if (!res.ok) { setError(res.error ?? "Bulk add failed."); return; }
    const symbols = Array.isArray(res.data.symbols) ? (res.data.symbols as string[]) : [];
    setAdded({ n: Number(res.data.added ?? 0), symbols });
    setStamp((s) => s + 1);
    router.refresh();
  }

  /** The new listings are cold by definition — this is the one-click warm-up. */
  async function fillHistory() {
    setFill("running");
    setFillNote("filling 5 years for the new listings…");
    const res = await send("/api/admin/historian", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "cold", years: 5 }),
    });
    if (!res.ok) { setFill("error"); setFillNote(res.error ?? "Deep fill failed."); return; }
    const r = (res.data.report ?? {}) as Record<string, number | string[] | undefined>;
    const errs = Array.isArray(r.errors) ? r.errors.length : 0;
    setFill("done");
    setFillNote(`${r.symbols ?? 0} symbols · ${Number(r.barsWritten ?? 0).toLocaleString()} bars` +
      `${errs ? ` · ${errs} errors` : ""}`);
    router.refresh();
  }

  return (
    <section className="raised mt-4 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">Grow the universe</h2>
        <p className="text-[11px] text-ink-4">
          Bulk-list a slice of the directory. Adds only — nothing already curated is touched.
        </p>
      </div>

      {/* Filter row — every control clears 44px on a phone and wraps freely */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">kind</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setExchange(""); }}
            aria-label="Directory kind to list"
            className={`${FIELD} uppercase tracking-[0.1em]`}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">exchange</span>
          <select value={exchange} onChange={(e) => setExchange(e.target.value)}
            aria-label="Exchange filter"
            className={`${FIELD} uppercase tracking-[0.1em]`}>
            <option value="">any</option>
            {(preview?.exchanges ?? []).map((x) => (
              <option key={x.code} value={x.code}>{x.code} · {x.available}</option>
            ))}
            {exchange && !(preview?.exchanges ?? []).some((x) => x.code === exchange) && (
              <option value={exchange}>{exchange}</option>
            )}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">count</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}
            aria-label="How many to add"
            className={`${FIELD} tnum`}>
            {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">file under</span>
          <select value={cat} onChange={(e) => setCat(e.target.value as "auto" | Category)}
            aria-label="Category to file the new listings under"
            className={`${FIELD} uppercase tracking-[0.1em]`}>
            <option value="auto">auto</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Narrow by ticker or name…" aria-label="Narrow the sweep"
          autoComplete="off"
          className={`${FIELD} w-44 placeholder:text-ink-4`} />
      </div>

      {/* The count, then the commit — never the other way round */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
        <p className="font-mono text-[11px] text-ink-4">
          {loading && !preview ? (
            <span className="skeleton inline-block h-3 w-28 align-middle" />
          ) : error ? (
            <span className="text-loss">{error}</span>
          ) : (
            <>
              <span className={`tnum text-sm font-semibold ${available ? "text-ink-1" : "text-ink-4"}`}>
                {available.toLocaleString()}
              </span>{" "}
              available, not yet listed
              {available > 0 && (
                <span className="text-ink-4"> · this adds {willAdd.toLocaleString()}</span>
              )}
            </>
          )}
        </p>

        <button type="button" onClick={commit}
          disabled={adding || loading || willAdd < 1}
          className={`${CHIP} ml-auto ${willAdd > 0
            ? "border-agent/50 bg-agent/15 text-agent hover:bg-agent/25"
            : "border-hairline text-ink-4"}`}>
          {adding ? "listing…" : `list ${willAdd.toLocaleString()}`}
        </button>
      </div>

      {/* First few of what the sweep would take — the filter made concrete */}
      {!error && preview && preview.sample.length > 0 && !added && (
        <p className="mt-2 truncate font-mono text-[10px] text-ink-4">
          first: {preview.sample.map((s) => s.symbol).join(" · ")}
          {available > preview.sample.length ? " …" : ""}
        </p>
      )}

      {/* The result, and the warm-up that always follows it */}
      {added && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
          <p className="min-w-0 font-mono text-[11px] text-ink-3">
            <span className="tnum text-gain">+{added.n.toLocaleString()}</span> listed
            {added.symbols.length > 0 && (
              <span className="text-ink-4"> · {added.symbols.slice(0, 6).join(" · ")}
                {added.symbols.length > 6 ? ` +${added.symbols.length - 6}` : ""}</span>
            )}
          </p>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {fillNote && (
              <span className={`font-mono text-[10px] ${fill === "error" ? "text-loss" : "text-ink-4"}`}>
                {fillNote}
              </span>
            )}
            {added.n > 0 && (
              <button type="button" onClick={fillHistory} disabled={fill === "running"}
                className={`${CHIP} border-gold/50 bg-gold/10 text-gold hover:bg-gold/20`}>
                {fill === "running" ? "filling…" : "fill history"}
              </button>
            )}
          </span>
        </div>
      )}

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
        shortest tickers first · max 500 per sweep · new listings rank after the board tail
      </p>
    </section>
  );
}

/* ── Backfill ──────────────────────────────────────────────────────────── */

/** One healing pass — the way an operator warms the cold listings. */
function BackfillPass() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  async function run() {
    setState("running");
    setNote("");
    const res = await send("/api/admin/backfill", { method: "POST" });
    if (!res.ok) { setState("error"); setNote(res.error ?? "Backfill failed."); return; }
    const r = (res.data.report ?? {}) as Record<string, number | boolean>;
    setState("done");
    setNote(`considered ${r.considered ?? 0} · synced ${r.synced ?? 0} · fresh ${r.fresh ?? 0}` +
      `${r.errors ? ` · ${r.errors} errors` : ""}${r.stoppedForTokens ? " · token-limited" : ""}`);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      {note && <span className={`font-mono text-[10px] ${state === "error" ? "text-loss" : "text-ink-4"}`}>{note}</span>}
      <button type="button" onClick={run} disabled={state === "running"}
        className={`${CHIP} border-hairline text-ink-2 hover:text-ink-1`}>
        {state === "running" ? "backfilling…" : "run backfill"}
      </button>
    </span>
  );
}

/*
  Deep history — the historian. Pulls years of bars from Alpaca in batched
  requests (many symbols per call), so a whole board fills in minutes rather
  than days on the rate-limited quote provider. "cold only" is the fast path
  for newly added listings.
*/
function DeepHistory() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  async function run(scope: "cold" | "board") {
    setState("running");
    setNote(scope === "cold" ? "filling new listings…" : "filling 5 years for the whole board…");
    const res = await send("/api/admin/historian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope === "cold" ? { scope: "cold", years: 5 } : { years: 5 }),
    });
    if (!res.ok) { setState("error"); setNote(res.error ?? "Deep fill failed."); return; }
    const r = (res.data.report ?? {}) as Record<string, number | string[] | undefined>;
    const errs = Array.isArray(r.errors) ? r.errors.length : 0;
    setState("done");
    setNote(`${r.symbols ?? 0} symbols · ${r.requests ?? 0} requests · ${(r.barsWritten ?? 0).toLocaleString()} bars` +
      `${errs ? ` · ${errs} errors` : ""}`);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      {note && <span className={`font-mono text-[10px] ${state === "error" ? "text-loss" : "text-ink-4"}`}>{note}</span>}
      <button type="button" onClick={() => run("cold")} disabled={state === "running"}
        className={`${CHIP} border-hairline text-ink-2 hover:text-ink-1`}>
        fill cold
      </button>
      <button type="button" onClick={() => run("board")} disabled={state === "running"}
        className={`${CHIP} border-agent/40 bg-agent/10 text-agent hover:bg-agent/15`}>
        {state === "running" ? "loading history…" : "load 5y history"}
      </button>
    </span>
  );
}
