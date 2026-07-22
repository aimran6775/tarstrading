"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/*
  The authenticated shell header: wordmark, quiet simulated marker, section
  nav, theme, logout. One component so every app surface wears the same hat.
*/
export default function AppNav({ active }: { active: "terminal" | "academy" | "agents" }) {
  const router = useRouter();
  return (
    <header className="glass sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 md:px-6">
      <div className="flex items-center gap-3">
        <Link href="/app" className="font-display text-sm font-bold tracking-[0.08em] text-ink-1">
          TARS
        </Link>
        <span className="sim-mark" title="All capital on Tars is simulated — no real money.">
          SIMULATED
        </span>
        <nav className="ml-2 hidden gap-1 sm:flex">
          {([
            ["terminal", "Terminal", "/app"],
            ["academy", "Academy", "/app/academy"],
            ["agents", "Agents", "/app/agents"],
          ] as const).map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              className={`pressable rounded-full px-3.5 py-1.5 text-xs font-medium ${
                active === key ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/");
          }}
          className="pressable rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1"
        >
          Log out
        </button>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "auto");
  }, []);
  function cycle() {
    const next = theme === "dark" ? "light" : theme === "light" ? "auto" : "dark";
    setTheme(next);
    if (next === "auto") {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("tars-theme");
    } else {
      document.documentElement.dataset.theme = next;
      localStorage.setItem("tars-theme", next);
    }
  }
  return (
    <button
      onClick={cycle}
      className="pressable rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1"
      title="Theme: dark → light → auto"
    >
      {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
    </button>
  );
}
