import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq, sql, inArray, desc } from "drizzle-orm";
import { currentAdmin } from "@/server/auth";
import { db, schema } from "@/server/db";

/*
  Markets control — the curated house board the product shows.

  API-first by design: these JSON endpoints are the control plane for the web
  console today and for the iOS/Android apps later. The product reads the same
  table (platform_symbols); an empty table means the app falls back to its
  built-in defaults, so the board can never be accidentally emptied to nothing.
*/

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["stocks", "crypto", "etf"]);

/** GET — the board, enriched with data coverage so operators see what's warm. */
export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 403 });

  const board = await db.select().from(schema.platformSymbols)
    .orderBy(schema.platformSymbols.rank, schema.platformSymbols.symbol);

  // Coverage: how many stored bars back each listed symbol (warm vs cold).
  const symbols = board.map((b) => b.symbol);
  const coverage = new Map<string, number>();
  if (symbols.length) {
    const rows = await db.select({
      symbol: schema.bars.symbol, n: sql<number>`count(*)::int`,
    }).from(schema.bars).where(inArray(schema.bars.symbol, symbols))
      .groupBy(schema.bars.symbol);
    for (const r of rows) coverage.set(r.symbol, r.n);
  }

  return NextResponse.json({
    ok: true,
    board: board.map((b) => ({ ...b, bars: coverage.get(b.symbol) ?? 0 })),
    counts: {
      total: board.length,
      enabled: board.filter((b) => b.enabled === 1).length,
      featured: board.filter((b) => b.featured === 1).length,
    },
  });
}

/** POST — add a symbol to the board (idempotent: re-adding re-enables it). */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  if (!symbol) return NextResponse.json({ ok: false, error: "Symbol required." }, { status: 400 });

  const category = CATEGORIES.has(body.category) ? body.category
    : symbol.includes("/") ? "crypto" : "stocks";
  const rank = Number.isFinite(Number(body.rank)) ? Number(body.rank) : 100;

  await db.insert(schema.platformSymbols).values({
    symbol, category, rank, featured: body.featured ? 1 : 0, enabled: 1,
    note: typeof body.note === "string" ? body.note.slice(0, 200) : null,
    addedAt: Date.now(),
  }).onConflictDoUpdate({
    target: schema.platformSymbols.symbol,
    set: { enabled: 1, category, rank },
  });

  await audit(admin.id, "market.add", { symbol, category, rank });
  return NextResponse.json({ ok: true, symbol });
}

/** PATCH — edit one listing (category, rank, featured, enabled, note). */
export async function PATCH(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  if (!symbol) return NextResponse.json({ ok: false, error: "Symbol required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (CATEGORIES.has(body.category)) patch.category = body.category;
  if (Number.isFinite(Number(body.rank))) patch.rank = Number(body.rank);
  if (body.featured !== undefined) patch.featured = body.featured ? 1 : 0;
  if (body.enabled !== undefined) patch.enabled = body.enabled ? 1 : 0;
  if (typeof body.note === "string") patch.note = body.note.slice(0, 200);
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  }

  await db.update(schema.platformSymbols).set(patch)
    .where(eq(schema.platformSymbols.symbol, symbol));
  await audit(admin.id, "market.edit", { symbol, ...patch });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a listing entirely (?symbol=AAPL). */
export async function DELETE(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const symbol = new URL(req.url).searchParams.get("symbol")?.toUpperCase().trim();
  if (!symbol) return NextResponse.json({ ok: false, error: "Symbol required." }, { status: 400 });

  await db.delete(schema.platformSymbols).where(eq(schema.platformSymbols.symbol, symbol));
  await audit(admin.id, "market.remove", { symbol });
  return NextResponse.json({ ok: true });
}

/** Every board change lands in the admin audit trail. */
async function audit(userId: string, action: string, detail: unknown) {
  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId, action,
    detail: JSON.stringify(detail), createdAt: Date.now(),
  }).catch(() => { /* audit must never block an operator action */ });
}
