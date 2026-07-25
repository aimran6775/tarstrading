"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
  The control center's live switches. Each posts to an audited admin route and
  reflects the new state immediately. The two big ones are platform kill
  switches; the ops buttons are one-shot maintenance actions.
*/

type Cfg = { tradingHalted: boolean; agentsPaused: boolean; announcement: string };

export default function ControlPanel({ initial }: { initial: Cfg }) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial);
  const [ann, setAnn] = useState(initial.announcement);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

  async function setKey(key: string, value: boolean | string) {
    setBusy(key); setNote("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const d = await res.json();
      if (d.ok) {
        setCfg((c) => key === "trading_halted" ? { ...c, tradingHalted: value === "1" || value === true }
          : key === "agents_paused" ? { ...c, agentsPaused: value === "1" || value === true }
          : { ...c, announcement: String(value) });
        setNote("Saved."); router.refresh();
      } else setNote(d.error || "Failed.");
    } catch { setNote("Network error."); }
    finally { setBusy(null); }
  }

  async function op(o: string) {
    setBusy(o); setNote("");
    try {
      const res = await fetch("/api/admin/ops", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: o }),
      });
      const d = await res.json();
      setNote(d.ok ? `Done${d.result ? ` — ${JSON.stringify(d.result)}` : ""}.` : (d.error || "Failed."));
      router.refresh();
    } catch { setNote("Network error."); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-4 grid gap-3 md:grid-cols-2">
      <Switch
        label="Order flow" onLabel="LIVE" offLabel="HALTED"
        on={!cfg.tradingHalted} danger
        busy={busy === "trading_halted"}
        onToggle={() => setKey("trading_halted", !cfg.tradingHalted)}
        desc={cfg.tradingHalted ? "All new orders are being rejected platform-wide." : "Traders can place orders normally."}
      />
      <Switch
        label="Analysts" onLabel="RUNNING" offLabel="PAUSED"
        on={!cfg.agentsPaused} danger
        busy={busy === "agents_paused"}
        onToggle={() => setKey("agents_paused", !cfg.agentsPaused)}
        desc={cfg.agentsPaused ? "Every analyst is frozen — the heartbeat skips them." : "Analysts tick on the schedule."}
      />

      <div className="panel p-4 md:col-span-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Broadcast banner</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={ann} onChange={(e) => setAnn(e.target.value)} maxLength={240}
            placeholder="Shown to every user across the app. Empty to clear."
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-bg2 px-3 py-2 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-agent/50" />
          <button onClick={() => setKey("announcement", ann)} disabled={busy === "announcement"}
            className="pressable rounded-lg bg-agent/15 px-4 py-2 text-sm font-semibold text-agent disabled:opacity-50">
            {busy === "announcement" ? "Saving…" : "Publish"}
          </button>
          {cfg.announcement && (
            <button onClick={() => { setAnn(""); setKey("announcement", ""); }}
              className="pressable rounded-lg border border-hairline px-4 py-2 text-sm text-ink-3 hover:text-ink-1">Clear</button>
          )}
        </div>
      </div>

      <div className="panel flex flex-wrap items-center gap-2 p-4 md:col-span-2">
        <p className="mr-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Ops</p>
        <OpBtn label="Flush quote cache" busy={busy === "flush-quotes"} onClick={() => op("flush-quotes")} />
        <OpBtn label="Run agent tick now" busy={busy === "run-tick"} onClick={() => op("run-tick")} />
        <OpBtn label="Sync US tickers" busy={busy === "sync-tickers"} onClick={() => op("sync-tickers")} />
        {note && <span className="ml-auto font-mono text-[11px] text-ink-3">{note}</span>}
      </div>
    </section>
  );
}

function Switch({ label, onLabel, offLabel, on, danger, busy, onToggle, desc }: {
  label: string; onLabel: string; offLabel: string; on: boolean; danger?: boolean; busy: boolean; onToggle: () => void; desc: string;
}) {
  const off = !on;
  return (
    <div className={`panel p-4 ${off && danger ? "border-loss/50" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${off && danger ? "text-loss" : "text-gain"}`}>
          {on ? onLabel : offLabel}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{desc}</p>
      <button onClick={onToggle} disabled={busy}
        className={`pressable mt-3 w-full rounded-lg py-2 text-sm font-semibold disabled:opacity-50 ${
          off ? "cta-gold" : "border border-loss/50 bg-loss/10 text-loss"
        }`}>
        {busy ? "Working…" : on ? `${label === "Analysts" ? "Pause analysts" : "Halt order flow"}` : `Resume`}
      </button>
    </div>
  );
}

function OpBtn({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="pressable rounded-lg border border-hairline px-3 py-2 text-xs text-ink-2 hover:text-ink-1 disabled:opacity-50">
      {busy ? "…" : label}
    </button>
  );
}
