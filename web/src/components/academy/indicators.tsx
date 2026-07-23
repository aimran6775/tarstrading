"use client";

import { useState } from "react";

/*
  Market-tool widgets: the instruments a real desk reads. Each is illustrative,
  not a live feed — the goal is to build intuition for what the number means,
  and (just as important) what it does NOT promise. Indicators describe; they
  never predict.
*/

/* ---------------- RSI: momentum as a bounded 0–100 reading ---------------- */

export function RSIMeter() {
  const [upDays, setUpDays] = useState(9); // of the last 14

  // A teaching-grade RSI: with roughly equal-sized moves, RSI tracks the share
  // of recent days that closed up. Enough to feel the zones without a data feed.
  const rsi = Math.round((upDays / 14) * 100);
  const zone = rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
  const tone = rsi >= 70 ? "loss" : rsi <= 30 ? "gain" : "ink-2";

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">RSI · momentum meter</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        RSI squeezes recent momentum into a single 0–100 reading. Above 70 is called
        &ldquo;overbought,&rdquo; below 30 &ldquo;oversold.&rdquo; Slide how many of the last 14 days closed up.
      </p>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Up days (of 14)</span><span className="tnum text-ink-2">{upDays}</span>
        </span>
        <input type="range" min={0} max={14} value={upDays}
          onChange={(e) => setUpDays(Number(e.target.value))}
          aria-label="Number of up days out of the last 14"
          className="mt-2 w-full accent-gold" />
      </label>

      {/* gauge */}
      <div className="mt-5">
        <div className="relative h-3 overflow-hidden rounded-full" style={{
          background: "linear-gradient(90deg, var(--gain) 0%, var(--gain) 30%, var(--bg3) 30%, var(--bg3) 70%, var(--loss) 70%, var(--loss) 100%)",
        }}>
          <div className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-ink-1 shadow"
            style={{ left: `calc(${rsi}% - 2px)` }} aria-hidden />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-ink-4"><span>0 · oversold</span><span>50</span><span>overbought · 100</span></div>
      </div>

      <p className="mt-4 text-sm" aria-live="polite">
        <span className={`tnum text-2xl font-semibold text-${tone}`}>{rsi}</span>
        <span className="ml-2 text-ink-3">— {zone}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-4">
        {zone === "overbought"
          ? "Overbought doesn't mean 'sell.' Strong trends stay overbought for weeks — an indicator reading is context, never a command."
          : zone === "oversold"
            ? "Oversold doesn't mean 'buy.' Things that are falling can keep falling. RSI describes what happened, it doesn't predict what's next."
            : "In the middle, RSI is quiet — no edge here. The mistake beginners make is treating 70/30 as automatic buy/sell buttons. They aren't."}
      </p>
    </div>
  );
}

/* ---------------- Forward curve: contango vs. backwardation ---------------- */

export function ForwardCurve() {
  const [shape, setShape] = useState<"contango" | "backwardation">("contango");
  const months = ["Spot", "1M", "2M", "3M", "6M", "1Y"];
  const spot = 100;
  const slope = shape === "contango" ? 1.6 : -1.6;
  const prices = months.map((_, i) => spot + slope * i);

  const W = 320, H = 130, pad = 24;
  const xs = (i: number) => pad + (i / (months.length - 1)) * (W - 2 * pad);
  const lo = Math.min(...prices) - 3, hi = Math.max(...prices) + 3;
  const ys = (p: number) => H - pad - ((p - lo) / (hi - lo)) * (H - 2 * pad);
  const path = prices.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(p)}`).join(" ");

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">The futures curve</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        A futures contract has a price for each delivery date. Line them up and you get the curve.
        Its slope has a name — and it quietly costs or pays you to hold a position over time.
      </p>

      <div className="mt-4 flex gap-1 rounded-full border border-hairline bg-bg1 p-1 text-xs">
        {(["contango", "backwardation"] as const).map((s) => (
          <button key={s} onClick={() => setShape(s)}
            className={`pressable flex-1 rounded-full px-3 py-1.5 font-medium capitalize ${
              shape === s ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
            }`}>{s}</button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img"
        aria-label={`Futures curve in ${shape}: prices slope ${shape === "contango" ? "up" : "down"} over time`}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--hairline)" />
        <path d={path} fill="none" stroke={`var(--${shape === "contango" ? "loss" : "gain"})`} strokeWidth="2" />
        {prices.map((p, i) => (
          <circle key={i} cx={xs(i)} cy={ys(p)} r="3" fill={`var(--${shape === "contango" ? "loss" : "gain"})`} />
        ))}
        {months.map((m, i) => (
          <text key={i} x={xs(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--ink-4)">{m}</text>
        ))}
      </svg>

      <p className="mt-2 text-xs leading-relaxed text-ink-4">
        {shape === "contango"
          ? "Contango: later dates cost more. Holding a long position, each month you 'roll' into a pricier contract — a slow bleed called negative roll yield. It's why leveraged commodity ETFs can drift lower even when spot is flat."
          : "Backwardation: later dates are cheaper. Rolling a long position each month buys in lower — roll yield works for you. Often a sign of tight near-term supply."}
      </p>
    </div>
  );
}

/* ---------------- Greeks: how an option's risk shifts as things move ---------------- */

export function GreeksExplorer() {
  const [moneyness, setMoneyness] = useState(0); // spot − strike, in % of strike
  const [days, setDays] = useState(30);

  // Illustrative, not a pricing model. Delta ~ how ITM the call is; theta (decay)
  // is worst at-the-money and accelerates into expiry; vega fades near expiry.
  const m = moneyness / 100;
  const t = days / 365;
  const delta = Math.max(0.01, Math.min(0.99, 0.5 + m * 4));
  const atmCloseness = Math.exp(-Math.pow(m * 6, 2)); // 1 at the money, →0 away
  const theta = -(atmCloseness / Math.max(0.06, Math.sqrt(t))) * 6; // more negative near expiry, ATM
  const vega = atmCloseness * Math.sqrt(t) * 40;

  const state = moneyness > 3 ? "in the money" : moneyness < -3 ? "out of the money" : "at the money";

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">The Greeks · a call option</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        The Greeks measure how an option&apos;s value reacts to the world. Move the stock (vs. the strike) and
        the clock, and watch which risks wake up. Values are illustrative — the behavior is what matters.
      </p>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Stock vs. strike</span><span className="tnum text-ink-2">{moneyness > 0 ? "+" : ""}{moneyness}% · {state}</span>
        </span>
        <input type="range" min={-15} max={15} value={moneyness}
          onChange={(e) => setMoneyness(Number(e.target.value))}
          aria-label="Stock price relative to strike, percent" className="mt-2 w-full accent-agent" />
      </label>
      <label className="mt-3 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Days to expiry</span><span className="tnum text-ink-2">{days}d</span>
        </span>
        <input type="range" min={1} max={90} value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Days until expiry" className="mt-2 w-full accent-agent" />
      </label>

      <div className="mt-5 grid grid-cols-3 gap-3" aria-live="polite">
        <Greek name="Delta" value={delta.toFixed(2)} hint="moves with the stock" />
        <Greek name="Theta" value={theta.toFixed(2)} hint="daily time decay" tone="loss" />
        <Greek name="Vega" value={vega.toFixed(1)} hint="sensitivity to vol" />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-4">
        {days <= 10 && state === "at the money"
          ? "At the money with days left, theta is brutal — an ATM option is a melting ice cube, losing value every day the stock sits still. This is why buyers need the move to come soon."
          : state === "in the money"
            ? "Deep in the money, delta approaches 1 — the option now moves almost dollar-for-dollar with the stock, and decay matters less. It behaves more like the shares."
            : state === "out of the money"
              ? "Out of the money, delta is small — the stock has to travel just to matter, and theta quietly erodes the premium while you wait."
              : "At the money, the option is all potential: highest theta (fastest decay) and highest vega (most sensitive to volatility). Time is the enemy here."}
      </p>
    </div>
  );
}

function Greek({ name, value, hint, tone = "ink-1" }: { name: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-bg2/50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">{name}</p>
      <p className={`tnum mt-1 text-lg font-semibold text-${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink-4">{hint}</p>
    </div>
  );
}
