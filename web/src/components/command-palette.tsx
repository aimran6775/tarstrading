"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchSymbols, SYMBOLS as SYMBOL_DICT } from "@/lib/symbols";

/*
  ⌘K / Ctrl-K from anywhere: jump to a symbol's chart or navigate the app.
  A pro affordance that also makes the whole product feel faster to move
  through. Fully keyboard-driven; Esc closes, arrows move, Enter selects.
*/

type Item = { id: string; label: string; sub: string; run: () => void };

const SECTIONS: [string, string][] = [
  ["Markets — browse", "/app"],
  ["Academy", "/app/academy"],
  ["Placement test — skip what you know", "/app/academy/placement"],
  ["Missions — prove it with a real trade", "/app/academy/missions"],
  ["Replay — trade a famous market moment", "/app/academy/replay"],
  ["Practice — flashcards & drills", "/app/academy/practice"],
  ["Assistant — your desk", "/app/assistant"],
  ["Standings — badges & leaderboard", "/app/standings"],
  ["Performance", "/app/m/SPY?tray=perf"],
];

// Popular defaults shown before the user types anything.
const DEFAULT_SYMBOLS = ["AAPL", "NVDA", "TSLA", "SPY", "BTC/USD", "ETH/USD"];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQuery(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toUpperCase();
    const go = (href: string) => () => { setOpen(false); router.push(href); };

    const sections: Item[] = SECTIONS
      .filter(([label]) => !q || label.toUpperCase().includes(q))
      .map(([label, href]) => ({ id: `s:${href}`, label, sub: "Go to section", run: go(href) }));

    const matches = q ? searchSymbols(q, 6) : DEFAULT_SYMBOLS.map((s) => ({ symbol: s, name: "" }));
    const symMatches = matches.map((m) => ({
      id: `sym:${m.symbol}`, label: m.symbol,
      sub: m.name || "Open market", run: go(`/app/m/${encodeURIComponent(m.symbol)}`),
    }));

    // Free-form ticker: whatever the user typed, if it looks like a symbol and
    // isn't already in the dictionary matches, routed straight to its chart.
    const known = new Set([...SYMBOL_DICT.map((e) => e.symbol), ...matches.map((m) => m.symbol)]);
    const freeform: Item[] = q && /^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(q) && !known.has(q)
      ? [{ id: `free:${q}`, label: q, sub: "Open market", run: go(`/app/m/${encodeURIComponent(q)}`) }]
      : [];

    return [...freeform, ...symMatches, ...sections];
  }, [query, router]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      onClick={() => setOpen(false)}>
      <div aria-hidden className="absolute inset-0 bg-bg0/70 backdrop-blur-sm" />
      <div
        role="dialog" aria-label="Command palette"
        className="glass relative w-full max-w-lg overflow-hidden rounded-2xl border border-hairline shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); items[active]?.run(); }
          }}
          placeholder="Jump to a symbol or section…"
          className="w-full bg-transparent px-5 py-4 text-[15px] text-ink-1 outline-none placeholder:text-ink-4"
          aria-label="Command palette search"
        />
        <ul className="max-h-80 overflow-y-auto border-t border-hairline">
          {items.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-ink-4">No matches. Try a ticker like NVDA.</li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={item.run}
                className={`flex w-full items-center justify-between px-5 py-3 text-left ${
                  i === active ? "bg-bg3" : ""
                }`}>
                <span className="text-sm font-medium text-ink-1">{item.label}</span>
                <span className="text-[11px] text-ink-4">{item.sub}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-hairline px-5 py-2 text-[10px] text-ink-4">
          <span>↑↓ to move · ↵ to open · esc to close</span>
          <span className="tnum">⌘K</span>
        </div>
      </div>
    </div>
  );
}
