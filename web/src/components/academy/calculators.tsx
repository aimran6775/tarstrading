"use client";

import { useState } from "react";

/*
  Live calculators — the formula stops being an equation on a page and becomes
  a thing you push around. Drag the inputs, watch the number and its color
  respond. Every tool teaches the ONE relationship that matters.
*/

const usd = (v: number) => "$" + Math.round(v).toLocaleString();

function Slider({ label, value, set, min, max, step = 1, fmt }: {
  label: string; value: number; set: (n: number) => void;
  min: number; max: number; step?: number; fmt: (n: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3">{label}</span>
        <span className="tnum text-sm font-semibold text-ink-1">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--gold)]" />
    </label>
  );
}

export default function LessonCalc({ tool, title }: {
  tool: "position-size" | "risk-reward" | "expectancy" | "compounding";
  title?: string;
}) {
  return (
    <div className="card p-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        {title ?? "Try it"}
      </p>
      {tool === "position-size" && <PositionSize />}
      {tool === "risk-reward" && <RiskReward />}
      {tool === "expectancy" && <Expectancy />}
      {tool === "compounding" && <Compounding />}
    </div>
  );
}

/* ---------- Position sizing: the survival calculator ---------- */
function PositionSize() {
  const [account, setAccount] = useState(100_000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(96);
  const riskAmount = account * (riskPct / 100);
  const perShare = Math.abs(entry - stop);
  const shares = perShare > 0 ? Math.floor(riskAmount / perShare) : 0;
  const position = shares * entry;
  const overLeveraged = position > account;
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Account" value={account} set={setAccount} min={1000} max={250000} step={1000} fmt={usd} />
      <Slider label="Risk per trade" value={riskPct} set={setRiskPct} min={0.25} max={5} step={0.25} fmt={(v) => `${v}%`} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Entry price" value={entry} set={setEntry} min={5} max={300} fmt={(v) => usd(v)} />
        <Slider label="Stop price" value={stop} set={setStop} min={1} max={300} fmt={(v) => usd(v)} />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        <Stat label="Risk $" value={usd(riskAmount)} tone="loss" />
        <Stat label="Shares" value={shares.toLocaleString()} tone="ink" big />
        <Stat label="Position" value={usd(position)} tone={overLeveraged ? "loss" : "gain"} />
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        You risk <span className="text-loss">{usd(riskAmount)}</span> — no matter the stock&apos;s price. Move the stop closer to
        entry and you can hold <em>more</em> shares for the same risk. That&apos;s the whole trick: size from your stop, never from a hunch.
      </p>
    </div>
  );
}

/* ---------- Risk / reward ---------- */
function RiskReward() {
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(96);
  const [target, setTarget] = useState(112);
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const tone = rr >= 2 ? "gain" : rr >= 1 ? "gold" : "loss";
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Entry" value={entry} set={setEntry} min={20} max={200} fmt={usd} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Stop (risk)" value={stop} set={setStop} min={1} max={200} fmt={usd} />
        <Slider label="Target (reward)" value={target} set={setTarget} min={20} max={300} fmt={usd} />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        <Stat label="Risk" value={usd(risk)} tone="loss" />
        <Stat label="Reward" value={usd(reward)} tone="gain" />
        <Stat label="R : R" value={`${rr.toFixed(1)} : 1`} tone={tone} big />
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        {rr >= 2 ? "Healthy. " : rr >= 1 ? "Thin. " : "Upside down. "}
        At <span className={`text-${tone}`}>{rr.toFixed(1)}:1</span>, you can be wrong more than half the time and still come out
        ahead — if you actually let winners run to target and cut losers at the stop.
      </p>
    </div>
  );
}

/* ---------- Expectancy ---------- */
function Expectancy() {
  const [winRate, setWinRate] = useState(45);
  const [avgWin, setAvgWin] = useState(2);
  const [avgLoss, setAvgLoss] = useState(1);
  const w = winRate / 100;
  const exp = w * avgWin - (1 - w) * avgLoss; // in R (risk units)
  const per100 = exp * 100;
  const tone = exp > 0 ? "gain" : exp < 0 ? "loss" : "gold";
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Win rate" value={winRate} set={setWinRate} min={10} max={90} fmt={(v) => `${v}%`} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Avg win (R)" value={avgWin} set={setAvgWin} min={0.5} max={5} step={0.1} fmt={(v) => `${v}R`} />
        <Slider label="Avg loss (R)" value={avgLoss} set={setAvgLoss} min={0.5} max={3} step={0.1} fmt={(v) => `${v}R`} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-center">
        <Stat label="Per trade" value={`${exp >= 0 ? "+" : ""}${exp.toFixed(2)}R`} tone={tone} big />
        <Stat label="Per 100 trades" value={`${per100 >= 0 ? "+" : ""}${per100.toFixed(0)}R`} tone={tone} />
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        Expectancy = win% × avg win − loss% × avg loss. A <span className="text-gain">45% win rate</span> is deeply profitable
        when winners are twice the size of losers. A 70% win rate is a slow bleed if your losers are huge. Payoff beats accuracy.
      </p>
    </div>
  );
}

/* ---------- Compounding ---------- */
function Compounding() {
  const [start, setStart] = useState(100_000);
  const [perTrade, setPerTrade] = useState(1);
  const [trades, setTrades] = useState(100);
  const final = start * Math.pow(1 + perTrade / 100, trades);
  const gain = final - start;
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Starting capital" value={start} set={setStart} min={10000} max={250000} step={5000} fmt={usd} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label="Avg gain / trade" value={perTrade} set={setPerTrade} min={0.1} max={3} step={0.1} fmt={(v) => `${v}%`} />
        <Slider label="Trades" value={trades} set={setTrades} min={10} max={500} step={10} fmt={(v) => `${v}`} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-center">
        <Stat label="Ends at" value={usd(final)} tone="gain" big />
        <Stat label="Growth" value={`${((final / start - 1) * 100).toFixed(0)}%`} tone="gain" />
      </div>
      <p className="text-xs leading-relaxed text-ink-3">
        A boring <span className="text-gain">{perTrade}%</span> edge, repeated {trades} times, turns {usd(start)} into{" "}
        <span className="text-gain">{usd(final)}</span> — a <span className="text-gain">{usd(gain)}</span> gain. Small edges,
        many reps. This is why survival (not home runs) is the whole game.
      </p>
    </div>
  );
}

function Stat({ label, value, tone, big }: {
  label: string; value: string; tone: "gain" | "loss" | "gold" | "ink"; big?: boolean;
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : tone === "gold" ? "text-gold" : "text-ink-1";
  return (
    <div className="rounded-lg bg-bg2 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum font-semibold ${color} ${big ? "text-lg" : "text-sm"}`}>{value}</p>
    </div>
  );
}
