"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./theme-toggle";

/*
  The authenticated shell: a sticky top header (wordmark, simulated marker,
  desktop nav, optional right slot, theme, logout) plus a fixed bottom tab
  bar on mobile so the four sections are always reachable on a phone.
*/

export type Section = "terminal" | "academy" | "agents" | "tars";

const NAV: [Section, string, string][] = [
  ["terminal", "Terminal", "/app"],
  ["academy", "Academy", "/app/academy"],
  ["agents", "Agents", "/app/agents"],
  ["tars", "Tars", "/app/tars"],
];

const ICON: Record<Section, string> = {
  terminal: "M3 17l5-6 4 3 6-8", // sparkline
  academy: "M12 4L2 9l10 5 8-4v6M6 12v4c0 1 3 2 6 2s6-1 6-2v-4",
  agents: "M12 3a4 4 0 014 4v1a3 3 0 013 3v3a5 5 0 01-5 5H8a5 5 0 01-5-5v-3a3 3 0 013-3V7a4 4 0 014-4z M9 13h.01M15 13h.01",
  tars: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z",
};

export default function AppNav({ active, right }: { active: Section; right?: React.ReactNode }) {
  const router = useRouter();
  const [xp, setXp] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/academy").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.ok) setXp(d.xp);
    }).catch(() => {});
  }, []);
  // The desk tick runs wherever you are in the app, not just on the Agents
  // page — your analysts work while you read a lesson or chat with Tars.
  useEffect(() => {
    const tick = () => fetch("/api/agents/tick", { method: "POST" }).catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <>
      <header className="glass sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-3">
          <Link href="/app" className="font-display text-sm font-bold tracking-[0.08em] text-ink-1">TARS</Link>
          <Link href="/disclosures" className="sim-mark" title="All capital on Tars is simulated — no real money.">
            SIMULATED
          </Link>
          <nav className="ml-2 hidden gap-1 sm:flex">
            {NAV.map(([key, label, href]) => (
              <Link key={key} href={href}
                className={`pressable rounded-full px-3.5 py-1.5 text-xs font-medium ${
                  active === key ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
                }`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {xp != null && xp > 0 && (
            <span className="tnum hidden rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold sm:inline"
              title="Academy XP earned">{xp} XP</span>
          )}
          {right}
          <ThemeToggle />
          <button onClick={logout}
            className="pressable min-h-9 rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1">
            Log out
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar — the four sections, always reachable */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-hairline pb-[env(safe-area-inset-bottom)] sm:hidden">
        {NAV.map(([key, label, href]) => (
          <Link key={key} href={href}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              active === key ? "text-gold" : "text-ink-3"
            }`}
            aria-current={active === key ? "page" : undefined}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON[key]} />
            </svg>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
