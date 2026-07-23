"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/*
  The welcome mat. A new trader lands with $100k and no idea where to start —
  this checklist gives them four concrete first moves and quietly disappears
  once they're all done. State comes from data the app already keeps.
*/

type Steps = { hasTrade: boolean; hasLesson: boolean; hasChat: boolean; hasAgent: boolean };

const ITEMS: { key: keyof Steps; label: string; hint: string; href: string }[] = [
  { key: "hasLesson", label: "Learn one thing", hint: "Read a lesson in the Academy — start at zero.", href: "/app/academy" },
  { key: "hasTrade", label: "Make your first trade", hint: "Pick a symbol, size it small, hold the gold button.", href: "/app" },
  { key: "hasChat", label: "Meet your assistant", hint: "Tell it what to build — it hires an analyst to run it.", href: "/app/assistant" },
  { key: "hasAgent", label: "Hire an analyst", hint: "Describe a strategy in plain English; deploy it on your word.", href: "/app/assistant" },
];

export default function GettingStarted() {
  const [steps, setSteps] = useState<Steps | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("tars-onboarding-dismissed") === "1") { setDismissed(true); return; }
    fetch("/api/onboarding").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.ok) {
        setSteps(d.steps);
        if (d.done) setDismissed(true); // auto-retire when every box is ticked
      }
    }).catch(() => {});
  }, []);

  if (dismissed || !steps) return null;
  const done = ITEMS.filter((i) => steps[i.key]).length;

  return (
    <section className="card mx-4 mt-4 overflow-hidden md:mx-6" aria-label="Getting started">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Getting started</h2>
          <span className="tnum text-[11px] text-ink-4">{done}/{ITEMS.length}</span>
        </div>
        <button
          onClick={() => { localStorage.setItem("tars-onboarding-dismissed", "1"); setDismissed(true); }}
          className="pressable text-[11px] text-ink-4 hover:text-ink-2">
          Dismiss
        </button>
      </div>
      <ul className="grid gap-px bg-hairline sm:grid-cols-2">
        {ITEMS.map((item) => {
          const complete = steps[item.key];
          return (
            <li key={item.key} className="bg-bg2">
              <Link href={item.href}
                className={`flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-bg3/50 ${complete ? "opacity-55" : ""}`}>
                <span aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    complete ? "border-transparent bg-gain text-onfill" : "border-gold/50 text-transparent"
                  }`}>
                  ✓
                </span>
                <span>
                  <span className={`block text-sm font-medium ${complete ? "text-ink-3 line-through" : "text-ink-1"}`}>
                    {item.label}
                  </span>
                  <span className="block text-xs text-ink-4">{item.hint}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
