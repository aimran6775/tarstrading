"use client";

import { useId, useMemo } from "react";
import { compact, type Commitment, type Flow } from "./types";

/*
  THE J-CURVE — the signature element of this desk.

  What it plots, per quarter of a fund's life:

    net position = distributions + NAV − called

  i.e. everything you've gotten back plus what's still marked, against every
  dollar that has actually left your account. That number is NEGATIVE for
  years. Fees are charged on your whole commitment from day one while the
  investments underneath are still carried near cost, so the line dives before
  it climbs — the J. Selling that shape honestly is the entire lesson; a chart
  that started at zero and went up would teach the opposite of the truth.

  Only this one series is plotted, and the y-axis is scaled to it alone.
  Overlaying the raw cash line (calls run to the full commitment) would squash
  the position curve into a flat thread near zero and hide the very shape the
  chart exists to show; the called-vs-committed bar beside it carries that.

  ---- What is measured vs. what is reconstructed ----

  The cash-flow record is exact: every call and every distribution is a dated
  row. Today's mark is also fact — it's the reported NAV. Historic NAV is NOT stored — a fund reports a mark quarterly and the past
  isn't kept here — so the value line between the start and today is
  reconstructed from two things the fund does tell us:

    net position(q) = appreciation(q) − fees(q)

  which falls straight out of the arithmetic: before any value is created,
  your net position is exactly minus the fees taken from you.

  - fees(q) accumulates the management fee — on committed capital during the
    investment period, on capital still at work after it, quarterly.
  - appreciation(q) accrues back-loaded (exponent 1.6, the same shape the
    simulation uses), scaled so the curve lands EXACTLY on today's reported
    position. Both ends are anchored to fact; only the path between them is
    modeled, and the caption says so.
*/

export type CurvePoint = { q: number; position: number };

/** The investment period, in quarters — where the fee base switches. */
function investmentQuarters(termYears: number): number {
  return Math.min(20, Math.floor((termYears * 4) / 2));
}

export function buildCurve(c: Commitment, flows: Flow[]): CurvePoint[] {
  const horizon = Math.max(c.quarters - 1, ...flows.map((f) => f.quarter), 0);
  if (c.quarters < 1) return [];

  const mgmtFee = c.fund?.mgmtFee ?? 0.02;
  const invQ = investmentQuarters(c.fund?.termYears ?? 10);

  // Pass 1 — walk the exact cash record and accumulate the fee drag it implies.
  let call = 0, dist = 0, fees = 0;
  const rows: { q: number; fees: number }[] = [];
  for (let q = 0; q <= horizon; q++) {
    for (const f of flows) {
      if (f.quarter !== q) continue;
      if (f.kind === "call") call += f.amount; else dist += f.amount;
    }
    // Fee base: the whole commitment while the manager is still deploying,
    // then only the capital still at work. This is what digs the hole.
    const base = q < invQ ? c.committed : Math.max(0, call - dist);
    fees += (base * mgmtFee) / 4;
    rows.push({ q, fees });
  }

  // Pass 2 — anchor the value line to today's reported position and let the
  // accrual shape fill in the years between.
  const last = rows[rows.length - 1];
  const today = c.distributed + c.nav - c.called;
  const totalAppreciation = today + last.fees;
  const shape = (q: number) => Math.pow((q + 1) / (horizon + 1), 1.6);

  return rows.map((r) => ({ q: r.q, position: totalAppreciation * shape(r.q) - r.fees }));
}

/**
 * The first quarter AFTER the trough that the net position climbed back above
 * water — null if it never went under, or if it hasn't come back yet. Measured
 * from the trough rather than from the start so a curve that begins barely
 * above zero, dips, and recovers reports the recovery rather than nothing.
 */
export function breakevenQuarter(points: CurvePoint[]): number | null {
  let t = 0;
  for (let i = 1; i < points.length; i++) if (points[i].position < points[t].position) t = i;
  if (points[t].position >= 0) return null;
  for (let i = t + 1; i < points.length; i++) if (points[i].position >= 0) return points[i].q;
  return null;
}

const W = 320, H = 104, PAD = 6;

export default function JCurve({ commitment, flows, className = "" }: {
  commitment: Commitment;
  flows: Flow[];
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const points = useMemo(() => buildCurve(commitment, flows), [commitment, flows]);

  if (points.length < 2) {
    return (
      <div className={`flex h-[104px] items-center justify-center rounded-[10px] border border-dashed border-hairline px-4 text-center ${className}`}>
        <p className="text-[11px] leading-relaxed text-ink-4">
          The curve starts once the manager calls capital. Nothing has moved yet.
        </p>
      </div>
    );
  }

  // Scaled to the net-position series alone, with a little air top and bottom.
  // The zero line has to sit where the data puts it: a shallow dip should LOOK
  // shallow and a fund deep underwater should look it.
  const values = points.map((p) => p.position).concat(0);
  const raw = Math.max(...values) - Math.min(...values) || 1;
  const lo = Math.min(...values) - raw * 0.08;
  const hi = Math.max(...values) + raw * 0.08;
  const span = hi - lo;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
  const zeroY = y(0);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.position).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(2)},${zeroY.toFixed(2)} L${x(0).toFixed(2)},${zeroY.toFixed(2)} Z`;

  const last = points[points.length - 1];
  const trough = points.reduce((a, p) => (p.position < a.position ? p : a), points[0]);
  const be = breakevenQuarter(points);

  return (
    <figure className={className}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
          role="img" className="block overflow-visible"
          aria-label={`Net position by quarter. Deepest point ${compact(trough.position)} at quarter ${trough.q + 1}, latest ${compact(last.position)}.`}
        >
          <defs>
            <clipPath id={`${uid}-up`}><rect x="0" y="0" width={W} height={Math.max(0, zeroY)} /></clipPath>
            <clipPath id={`${uid}-dn`}><rect x="0" y={zeroY} width={W} height={Math.max(0, H - zeroY)} /></clipPath>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--gain)" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id={`${uid}-r`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--loss)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.28" />
            </linearGradient>
          </defs>

          {/* underwater below the line, above water above it */}
          <path d={area} fill={`url(#${uid}-g)`} clipPath={`url(#${uid}-up)`} />
          <path d={area} fill={`url(#${uid}-r)`} clipPath={`url(#${uid}-dn)`} />

          {/* the waterline */}
          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="var(--hairline-strong)" strokeWidth="1"
            strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />

          {/* net position — the J */}
          <path d={line} fill="none" stroke="var(--ink-1)" strokeWidth="1.75"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

          {/* today */}
          <circle cx={x(points.length - 1)} cy={y(last.position)} r="3.2" fill="var(--gold)" />
        </svg>

        {/* The waterline label lives in HTML — the SVG is non-uniformly scaled,
            which would stretch any text drawn inside it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 -translate-y-1/2 bg-transparent font-mono text-[9px] tracking-wider text-ink-4"
          style={{ top: `${(zeroY / H) * 100}%` }}
        >
          0
        </span>
      </div>

      <figcaption className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-3 text-[10px] text-ink-4">
          <span className="tnum">Q1 · {commitment.fund?.vintage ?? ""}</span>
          <span>Distributions + NAV − called</span>
          <span className="tnum">Q{points.length}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          {trough.position < 0 ? (
            <>
              Deepest underwater at <span className="tnum text-ink-2">{compact(trough.position)}</span> in
              Q{trough.q + 1}
              {be != null
                ? <> — back above water in Q{be + 1}.</>
                : <> — still below water, which is normal this early.</>}
            </>
          ) : (
            <>Above water throughout — the mark has outrun the fee drag from the first quarter.</>
          )}
          {" "}
          <span className="text-ink-4">
            Today&apos;s point is the fund&apos;s reported mark; the path between is reconstructed from the fee drag.
          </span>
        </p>
      </figcaption>
    </figure>
  );
}
