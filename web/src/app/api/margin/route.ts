import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { accountRisk } from "@/server/exchange";
import { financingRates } from "@/server/rates";
import { portfolioMargin } from "@/server/span";
import { futuresSpec, productOf, isFuturesSymbol } from "@/server/futures";
import { isOptionSymbol } from "@/server/options";

/*
  The Margin Desk API — the whole risk picture in one call, plus a what-if.

  Transparency is the differentiator: a real prime broker hands you a
  requirement number and a shrug. This returns every input — per-position
  requirements, the SPAN credits by name, the live rates financing runs on,
  the margin-call state with its deadline — so a user can recompute their own
  margin by hand. That's the whole teaching position.

  What-if: ?symbol=FUT:ESU6&qty=-1 answers "what happens to my requirement if
  I add this?" — priced through the same portfolioMargin() the order gate
  uses, so the preview can never disagree with the rejection.
*/
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const [risk, rates, positions, [account]] = await Promise.all([
    accountRisk(user.id),
    financingRates(),
    db.select().from(schema.positions).where(eq(schema.positions.userId, user.id)),
    db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id)),
  ]);

  // Per-position requirement rows — each names its own margin regime.
  const rows = positions.map((p) => {
    if (isFuturesSymbol(p.symbol)) {
      const spec = futuresSpec(p.symbol);
      return {
        symbol: p.symbol, qty: p.qty, regime: "SPAN" as const,
        detail: spec ? `$${spec.im.toLocaleString()} IM / $${spec.mm.toLocaleString()} MM per contract, before portfolio credits` : "",
        naiveIm: (spec?.im ?? 0) * Math.abs(p.qty),
      };
    }
    const crypto = p.symbol.includes("/");
    const option = isOptionSymbol(p.symbol);
    return {
      symbol: p.symbol, qty: p.qty,
      regime: crypto ? "Cash" as const : option ? "Cash-secured" as const : "Reg-T" as const,
      detail: crypto ? "100% — no leverage, no short"
        : option ? "Fully paid or collateralised at order time"
        : "50% initial, 25% maintenance",
      naiveIm: null,
    };
  });

  // The what-if: requirement with and without the contemplated futures leg.
  let preview = null;
  const wSymbol = url.searchParams.get("symbol")?.toUpperCase();
  const wQty = Number(url.searchParams.get("qty"));
  if (wSymbol && Number.isFinite(wQty) && wQty !== 0 && isFuturesSymbol(wSymbol) && productOf(wSymbol)) {
    const book = positions.filter((p) => isFuturesSymbol(p.symbol))
      .map((p) => ({ symbol: p.symbol, qty: p.qty }));
    const before = portfolioMargin(book);
    const after = portfolioMargin([...book, { symbol: wSymbol, qty: wQty }]);
    const naiveDelta = (futuresSpec(wSymbol)?.im ?? 0) * Math.abs(wQty);
    preview = {
      symbol: wSymbol, qty: wQty,
      imBefore: before.im, imAfter: after.im,
      delta: after.im - before.im,
      naiveDelta,
      creditVsNaive: naiveDelta - (after.im - before.im),
      // Same test the order gate applies: total initial requirement with the
      // new leg (securities part unchanged) must fit inside equity.
      affordable: (risk.initialReq - risk.span.im) + after.im <= risk.equity + 1e-6,
    };
  }

  return NextResponse.json({
    ok: true,
    risk,
    rates,
    positions: rows,
    marginCall: account?.marginCallAt
      ? { at: account.marginCallAt, cureBy: account.marginCallAt + 2 * 3600_000 }
      : null,
    preview,
    conventions: {
      settlement: "Equities settle T+1 (DTC convention); futures settle variation daily (CME convention); FX spot T+2; crypto immediate.",
      note: "Simulated desk. Margin methodology modeled on CME SPAN and Reg-T; no real clearing membership, no real money.",
    },
  });
}
