"use client";

import { useEffect, useState } from "react";

/** Dark → light → auto. Persists to localStorage; the boot script in the
    root layout applies it before first paint. Shared by app + marketing. */
export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => { setTheme(document.documentElement.dataset.theme ?? "auto"); }, []);

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

  const label = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto";
  return (
    <button
      onClick={cycle}
      className="pressable flex min-h-9 items-center rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1"
      title="Theme: dark → light → auto"
      aria-label={`Theme: ${label}. Tap to change.`}
    >
      {compact ? label[0] : label}
    </button>
  );
}
