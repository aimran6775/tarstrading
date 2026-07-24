"use client";

import { useEffect, useRef, useState } from "react";
import { searchSymbols, type SymbolEntry } from "@/lib/symbols";

/*
  Symbol field with autocomplete over the FULL tradable universe: the static
  curated list answers instantly on every keystroke, then the server directory
  (every active US-listed stock/ETF) replaces it when the debounced fetch
  lands. Keyboard-navigable; Enter on free-form text still submits anything.
*/
export default function SymbolInput({
  value, onChange, onSubmit, placeholder = "Add symbol — name or ticker",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (symbol: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<SymbolEntry[]>([]);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    // Instant local results now…
    setSuggestions(searchSymbols(value));
    setActive(0);
    // …full-market results ~150ms later (stale responses discarded).
    const q = value.trim();
    if (!q) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (mine === seq.current && Array.isArray(d.results) && d.results.length) {
          setSuggestions(d.results);
          setActive(0);
        }
      } catch { /* local results already shown */ }
    }, 150);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(sym: string) {
    onSubmit(sym);
    onChange("");
    setFocused(false);
  }

  const show = focused && suggestions.length > 0;

  return (
    <div ref={box} className="relative flex-1">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            choose(show ? suggestions[active].symbol : value.trim().toUpperCase());
          } else if (e.key === "Escape") setFocused(false);
        }}
        placeholder={placeholder}
        aria-label="Add symbol to watchlist"
        autoComplete="off"
        className="w-full rounded-full border border-hairline bg-bg2 px-4 py-2 text-xs text-ink-1 outline-none focus:border-gold"
      />
      {show && (
        <ul className="glass absolute bottom-full z-30 mb-2 w-full overflow-hidden rounded-xl border border-hairline shadow-xl">
          {suggestions.map((s, i) => (
            <li key={s.symbol}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s.symbol)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left ${i === active ? "bg-bg3" : ""}`}>
                <span className="text-xs font-semibold text-ink-1">{s.symbol}</span>
                <span className="text-[11px] text-ink-4">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
