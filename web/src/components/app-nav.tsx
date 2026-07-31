"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./theme-toggle";
import CommandPalette from "./command-palette";
import TarsWordmark from "./tars-wordmark";
import { Icon } from "./icons";

/*
  The authenticated shell header — a trading desk's masthead, not a SaaS bar.
  Full TARS TRADING lockup, a market-open pulse, nav tabs with a gold active
  underline, and the gold-block balance. The SIMULATED marker lives in the
  persistent footer ticker (still unmistakable, off the masthead). A fixed
  bottom tab bar keeps the five sections reachable on a phone.
*/

export type Section = "floor" | "terminal" | "academy" | "alternatives" | "assistant" | "standings";

const NAV: [Section, string, string][] = [
  ["floor", "Floor", "/app/floor"],
  ["terminal", "Markets", "/app"],
  ["academy", "Academy", "/app/academy"],
  ["alternatives", "Alternatives", "/app/alternatives"],
  ["assistant", "Assistant", "/app/assistant"],
  ["standings", "Standings", "/app/standings"],
];

const ICON: Record<Section, string> = {
  floor: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 13h7v7H4z", // dashboard tiles
  terminal: "M3 17l5-6 4 3 6-8", // sparkline
  academy: "M12 4L2 9l10 5 8-4v6M6 12v4c0 1 3 2 6 2s6-1 6-2v-4",
  // institution columns — the fund, the allocator's side of the house
  alternatives: "M3 9l9-5 9 5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18",
  // chat bubble — the assistant you talk to
  assistant: "M4 5h16v11H9l-4 4v-4H4z M8 10h.01M12 10h.01M16 10h.01",
  standings: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3", // trophy
};

/* Six tabs across a 375px phone leaves ~60px each, and "Alternatives" doesn't
   fit. The bottom bar gets the desk's own shorthand instead. */
const TAB_LABEL: Partial<Record<Section, string>> = { alternatives: "Alts" };

/** True during the US regular session (approximate, ET). Client-side mirror of
    the server clock — for the header pulse only, never for order gating. */
function usMarketOpen(): boolean {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = et.getDay();
  if (d === 0 || d === 6) return false;
  const m = et.getHours() * 60 + et.getMinutes();
  return m >= 9 * 60 + 30 && m < 16 * 60;
}

export default function AppNav({ active, right }: { active: Section; right?: React.ReactNode }) {
  const router = useRouter();
  const [xp, setXp] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/academy").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.ok) setXp(d.xp);
    }).catch(() => {});
  }, []);
  // Market pulse — evaluated client-side each minute.
  useEffect(() => {
    const set = () => setOpen(usMarketOpen());
    set();
    const id = setInterval(() => { if (typeof document !== "undefined" && document.hidden) return; set(); }, 60_000);
    return () => clearInterval(id);
  }, []);
  // The desk tick runs wherever you are in the app, not just on the Assistant
  // page — your analysts work while you read a lesson or browse markets.
  useEffect(() => {
    const tick = () => fetch("/api/agents/tick", { method: "POST" }).catch(() => {});
    tick();
    const id = setInterval(() => { if (typeof document !== "undefined" && document.hidden) return; tick(); }, 30_000);
    return () => clearInterval(id);
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <>
      <CommandPalette />
      <header className="glass sticky top-0 z-50">
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/app/floor" className="pressable shrink-0 whitespace-nowrap">
              {/*
                Full lockup above 400px, short one below. The show/hide lives on
                these WRAPPERS: TarsWordmark hardcodes `inline-flex` on its own
                root, and in Tailwind v4 a caller's `hidden` loses to it on
                stylesheet order — so both lockups used to render at once and
                the equity strip landed on top of the garbled result.
              */}
              <span className="hidden min-[400px]:block">
                <TarsWordmark size={22} text="TARS TRADING" />
              </span>
              <span className="min-[400px]:hidden">
                <TarsWordmark size={22} text="TARS" />
              </span>
            </Link>

            {/* Market pulse — a real desk always shows session state */}
            {open != null && (
              <span className="hidden items-center gap-1.5 border-l border-hairline pl-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4 xl:flex"
                title={open ? "US regular session is open" : "US regular session is closed — crypto trades 24/7"}>
                <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-gain" : "bg-ink-4"} ${open ? "animate-pulse" : ""}`} />
                {open ? "NYSE OPEN" : "NYSE CLOSED"}
              </span>
            )}

            <nav className="hidden gap-0.5 md:flex">
              {NAV.map(([key, label, href]) => {
                const on = active === key;
                return (
                  <Link key={key} href={href} aria-current={on ? "page" : undefined}
                    className={`pressable relative whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors xl:px-3.5 ${
                      on ? "text-ink-1" : "text-ink-3 hover:text-ink-1"
                    }`}>
                    {label}
                    {/* the gold active underline — the tape running under the tab */}
                    <span aria-hidden className={`absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full transition-opacity xl:inset-x-2.5 ${
                      on ? "bg-gold opacity-100" : "opacity-0"
                    }`} />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Search: label + shortcut on desktop; below lg the same palette
                opens from an icon — a phone has no ⌘K, and a market search
                you can't reach isn't a feature. */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="pressable hidden items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-4 hover:text-ink-2 lg:flex"
              aria-label="Open command palette">
              <span>Search</span><span className="tnum rounded bg-bg3 px-1.5 py-0.5">⌘K</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="pressable flex min-h-10 min-w-10 items-center justify-center rounded-full border border-hairline text-ink-3 hover:text-ink-1 lg:hidden"
              aria-label="Search markets">
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" />
              </svg>
            </button>
            {xp != null && xp > 0 && (
              <span className="tnum hidden items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold lg:flex"
                title="Gold blocks earned in the academy">
                <Icon.GoldBlock className="h-3.5 w-3.5" />{xp}
              </span>
            )}
            {right}
            <ThemeToggle />
            <button onClick={logout}
              className="pressable min-h-10 rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1">
              Log out
            </button>
          </div>
        </div>
        {/* hairline with a gold thread — the masthead's signature */}
        <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
      </header>

      {/* Mobile bottom tab bar — every section, always reachable */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-hairline pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(([key, label, href]) => (
          <Link key={key} href={href} aria-label={label}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-medium ${
              active === key ? "text-gold" : "text-ink-3"
            }`}
            aria-current={active === key ? "page" : undefined}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON[key]} />
            </svg>
            <span className="max-w-full truncate">{TAB_LABEL[key] ?? label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
