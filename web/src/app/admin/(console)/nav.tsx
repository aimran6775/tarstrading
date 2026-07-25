"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
  The console's section register — one source of truth, rendered two ways: a
  persistent sidebar on desktop, a horizontally scrollable rail on phones.

  The active section is the LONGEST matching prefix, so /admin/users/[id] still
  lights up "Users" while "/admin" only matches the Overview exactly. Violet is
  the control-center accent: it marks where you are and what you can operate,
  never what the data means.
*/

type IconKey = "deck" | "markets" | "academy" | "users" | "data" | "controls";
type Item = { label: string; href: string; icon: IconKey };
type Group = { title?: string; items: Item[] };

const NAV: Group[] = [
  { items: [{ label: "Overview", href: "/admin", icon: "deck" }] },
  {
    title: "Platform",
    items: [
      { label: "Markets", href: "/admin/markets", icon: "markets" },
      { label: "Academy", href: "/admin/academy", icon: "academy" },
      { label: "Users", href: "/admin/users", icon: "users" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Data ops", href: "/admin/data", icon: "data" },
      { label: "Controls", href: "/admin/system", icon: "controls" },
    ],
  },
];

const FLAT: Item[] = NAV.flatMap((g) => g.items);

/* ---- The console icon set ----
   Drawn to the house spec (24×24, stroke 1.6, round caps) but scoped to this
   file: operations glyphs, not the product's gold-flavored set. */
function Glyph({ name, className }: { name: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {name === "deck" && (
        <>
          <rect x="3.4" y="3.4" width="7.2" height="6.6" rx="1.3" />
          <rect x="13.4" y="3.4" width="7.2" height="3.4" rx="1.3" />
          <rect x="13.4" y="10.4" width="7.2" height="10.2" rx="1.3" />
          <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.3" />
        </>
      )}
      {name === "markets" && (
        <>
          <path d="M7 4.2v2.6M7 15.2v2.6" />
          <rect x="5.3" y="6.8" width="3.4" height="8.4" rx="1" />
          <path d="M16.6 5.6v2.2M16.6 15.4v2.6" />
          <rect x="14.9" y="7.8" width="3.4" height="7.6" rx="1" />
        </>
      )}
      {name === "academy" && (
        <>
          <path d="M2.8 9.2 12 4.8l9.2 4.4L12 13.6Z" />
          <path d="M6.7 11.5v4.1c0 1.15 2.37 2.3 5.3 2.3s5.3-1.15 5.3-2.3v-4.1" />
          <path d="M21.2 9.2v4.8" />
        </>
      )}
      {name === "users" && (
        <>
          <circle cx="9.4" cy="8.1" r="3.3" />
          <path d="M3.4 19.6a6 6 0 0 1 12 0" />
          <path d="M16.2 5.5a3.3 3.3 0 0 1 0 5.2M17.6 14.3a5.5 5.5 0 0 1 3.1 5.3" />
        </>
      )}
      {name === "data" && (
        <>
          <ellipse cx="12" cy="6.1" rx="7.1" ry="2.8" />
          <path d="M4.9 6.1v11.8c0 1.55 3.18 2.8 7.1 2.8s7.1-1.25 7.1-2.8V6.1" />
          <path d="M4.9 12c0 1.55 3.18 2.8 7.1 2.8s7.1-1.25 7.1-2.8" />
        </>
      )}
      {name === "controls" && (
        <>
          <path d="M4 7.6h8.2M16.8 7.6H20M4 16.4h3.2M11.8 16.4H20" />
          <circle cx="14.5" cy="7.6" r="2.3" />
          <circle cx="9.5" cy="16.4" r="2.3" />
        </>
      )}
    </svg>
  );
}

/** Longest-prefix match; "/admin" is exact so the deck never stays lit. */
function activeHref(path: string): string {
  return FLAT.reduce((best, item) => {
    const hit = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
    return hit && item.href.length > best.length ? item.href : best;
  }, "");
}

export default function AdminNav({ variant = "sidebar" }: { variant?: "sidebar" | "rail" }) {
  const active = activeHref(usePathname() ?? "");

  if (variant === "rail") {
    return (
      <nav aria-label="Console sections" className="flex items-center gap-1">
        {FLAT.map((item) => {
          const on = item.href === active;
          return (
            <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined}
              className={`pressable flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-xs whitespace-nowrap transition-colors ${
                on ? "bg-agent/15 text-agent" : "text-ink-3 hover:bg-bg2 hover:text-ink-1"
              }`}>
              <Glyph name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Console sections" className="flex flex-col gap-0.5">
      {NAV.map((group, gi) => (
        <div key={group.title ?? gi} className={group.title ? "mt-4" : ""}>
          {group.title && (
            <p className="px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-ink-4">{group.title}</p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const on = item.href === active;
              return (
                <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined}
                  className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors ${
                    on ? "bg-agent/12 font-medium text-agent" : "text-ink-3 hover:bg-bg2 hover:text-ink-1"
                  }`}>
                  {/* the violet rail — you are here */}
                  <span aria-hidden
                    className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-agent transition-opacity ${
                      on ? "opacity-100" : "opacity-0"
                    }`} />
                  <Glyph name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/*
  Sign out — ends the console session server-side, then leaves for the front
  door. `replace` so the back button can't land on a dead authenticated view.
*/
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/console-login", { method: "DELETE" });
    } catch {
      // The cookie is httpOnly — if the call failed we still send the operator
      // to the door, where the guard re-evaluates the session for real.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4.5h3.2a1.8 1.8 0 0 1 1.8 1.8v11.4a1.8 1.8 0 0 1-1.8 1.8h-3.2" />
      <path d="M10 8.4 6.4 12 10 15.6M6.4 12h8.4" />
    </svg>
  );

  if (compact) {
    return (
      <button type="button" onClick={signOut} disabled={busy} aria-label="Sign out of the control center"
        className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-bg2 hover:text-ink-1 disabled:opacity-50">
        {icon}
      </button>
    );
  }

  return (
    <button type="button" onClick={signOut} disabled={busy}
      className="pressable flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] text-ink-3 transition-colors hover:bg-bg2 hover:text-ink-1 disabled:opacity-50">
      {icon}
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
