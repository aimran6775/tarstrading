import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, ilike, notExists, or, sql } from "drizzle-orm";
import { currentAdmin } from "@/server/auth";
import { db, schema } from "@/server/db";

/*
  Bulk listing — growing the house universe a few hundred symbols at a time.

  The single-symbol route is curation by hand; this one is curation by the
  shovel-load: pick a slice of the tickers directory (kind, exchange, an
  optional name/ticker search), see how many of those are NOT yet listed, and
  file that many onto the board under one category.

  Deliberately one-directional. This endpoint only ever INSERTS — never
  updates, disables, or deletes an existing listing (onConflictDoNothing), and
  there is no bulk DELETE. Hand curation always outranks a bulk sweep, and a
  fat-fingered filter can cost an operator nothing but a few extra rows.
*/

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["stocks", "crypto", "etf"]);

/** Directory kinds an operator can sweep. Warrants, rights, units and the
    other exotica stay out — they are not things we want on a house board. */
const KINDS = new Set(["CS", "ETF", "ADRC", "CRYPTO"]);

/** The hard ceiling on one sweep. One click can never insert thousands. */
const MAX_LIMIT = 500;

type Filter = { kind?: string; exchange?: string; search?: string };

function readFilter(get: (k: string) => string | null | undefined): Filter {
  const kind = String(get("kind") ?? "").toUpperCase().trim();
  const exchange = String(get("exchange") ?? "").toUpperCase().trim();
  const search = String(get("search") ?? "").trim().slice(0, 40);
  return {
    kind: KINDS.has(kind) ? kind : undefined,
    exchange: /^[A-Z]{2,10}$/.test(exchange) ? exchange : undefined,
    search: search || undefined,
  };
}

/*
  The selection predicate: active directory rows matching the filter that the
  board does not already carry. `notExists` keeps the exclusion in Postgres —
  no 13k-symbol array crossing the wire to diff in JS.
*/
function where(f: Filter) {
  const clauses = [
    eq(schema.tickers.active, 1),
    notExists(
      db.select({ one: sql`1` }).from(schema.platformSymbols)
        .where(eq(schema.platformSymbols.symbol, schema.tickers.symbol)),
    ),
  ];
  if (f.kind) clauses.push(eq(schema.tickers.kind, f.kind));
  if (f.exchange) clauses.push(eq(schema.tickers.exchange, f.exchange));
  if (f.search) {
    const term = `%${f.search}%`;
    clauses.push(or(ilike(schema.tickers.symbol, term), ilike(schema.tickers.name, term))!);
  }
  return and(...clauses);
}

/*
  Ordering. The directory carries no volume or market cap, so there is no true
  "biggest first" to sort by — but ticker length is a decent proxy for age and
  stature (T, F, KO, AA, AAPL land before AACBU), and it is stable, so the same
  filter always fills the same way. Named honestly in the console.
*/
const ORDER = [sql`length(${schema.tickers.symbol})`, schema.tickers.symbol] as const;

/** GET — preview a sweep: how many match, and what the first ones look like. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const filter = readFilter((k) => params.get(k));

  const [[count], sample, exchanges] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.tickers).where(where(filter)),
    db.select({ symbol: schema.tickers.symbol, name: schema.tickers.name })
      .from(schema.tickers).where(where(filter)).orderBy(...ORDER).limit(8),
    // Facets under the current kind/search, so the exchange picker shows what
    // is actually there to take rather than a hardcoded list.
    db.select({ exchange: schema.tickers.exchange, n: sql<number>`count(*)::int` })
      .from(schema.tickers).where(where({ ...filter, exchange: undefined }))
      .groupBy(schema.tickers.exchange).orderBy(sql`count(*) desc`),
  ]);

  return NextResponse.json({
    ok: true,
    available: count?.n ?? 0,
    max: MAX_LIMIT,
    sample,
    exchanges: exchanges
      .filter((e) => e.exchange)
      .map((e) => ({ code: e.exchange as string, available: e.n })),
  });
}

/*
  POST — commit a sweep.

  Either a filter sweep:
    { kind?, exchange?, search?, limit, category }
  or an explicit list:
    { symbols: string[], category? }

  Both file the new listings at sequential ranks after the current board max,
  so a sweep lands underneath the hand-curated head of the board.
*/
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const explicit: string[] | null = Array.isArray(body.symbols)
    ? [...new Set((body.symbols as unknown[])
      .map((s) => String(s).toUpperCase().trim()).filter(Boolean))].slice(0, MAX_LIMIT)
    : null;

  const category: string | null = CATEGORIES.has(body.category) ? body.category : null;
  const filter = readFilter((k) => body[k]);

  let picked: string[];
  if (explicit) {
    if (!explicit.length) {
      return NextResponse.json({ ok: false, error: "No symbols given." }, { status: 400 });
    }
    // Already-listed symbols are skipped, not overwritten — curation wins.
    const listed = await db.select({ symbol: schema.platformSymbols.symbol })
      .from(schema.platformSymbols);
    const have = new Set(listed.map((r) => r.symbol));
    picked = explicit.filter((s) => !have.has(s));
  } else {
    const limit = Math.floor(Number(body.limit));
    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json({ ok: false, error: "A count of 1 or more is required." }, { status: 400 });
    }
    const rows = await db.select({ symbol: schema.tickers.symbol })
      .from(schema.tickers).where(where(filter))
      .orderBy(...ORDER).limit(Math.min(MAX_LIMIT, limit));
    picked = rows.map((r) => r.symbol);
  }

  if (!picked.length) {
    return NextResponse.json({ ok: true, added: 0, symbols: [], note: "Nothing new matched — every match is already listed." });
  }

  // Sequential ranks after the current tail of the board.
  const [tail] = await db.select({ max: sql<number>`coalesce(max(${schema.platformSymbols.rank}), 99)::int` })
    .from(schema.platformSymbols);
  const base = (tail?.max ?? 99) + 1;
  const now = Date.now();

  const values = picked.map((symbol, i) => ({
    symbol,
    category: category ?? (symbol.includes("/") ? "crypto" : filter.kind === "ETF" ? "etf" : "stocks"),
    rank: base + i,
    featured: 0,
    enabled: 1,
    note: null,
    addedAt: now,
  }));

  // Chunked so one sweep is a handful of bounded statements, and
  // onConflictDoNothing so a symbol that appeared on the board mid-sweep keeps
  // whatever an operator set on it.
  let added = 0;
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    const done = await db.insert(schema.platformSymbols).values(chunk)
      .onConflictDoNothing({ target: schema.platformSymbols.symbol })
      .returning({ symbol: schema.platformSymbols.symbol });
    added += done.length;
  }

  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId: admin.id, action: "market.bulk-add",
    detail: JSON.stringify({
      mode: explicit ? "list" : "filter",
      ...filter,
      category: category ?? "auto",
      requested: picked.length,
      added,
      // The audit records what landed, capped so one row stays readable.
      symbols: picked.slice(0, 100),
      truncated: picked.length > 100,
    }),
    createdAt: now,
  }).catch(() => { /* audit must never block an operator action */ });

  return NextResponse.json({ ok: true, added, symbols: picked.slice(0, MAX_LIMIT) });
}
