"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Admin nav with an active indicator. The active tab is the longest matching
  prefix, so /admin/users/[id] still lights up "Users" (and "/admin" only
  matches the Overview exactly).
*/
const NAV: [string, string][] = [
  ["Overview", "/admin"],
  ["Academy", "/admin/academy"],
  ["Data ops", "/admin/data"],
  ["Users", "/admin/users"],
  ["Controls", "/admin/system"],
];

export default function AdminNav() {
  const path = usePathname();
  const active = NAV.reduce((best, [, href]) => {
    const match = href === "/admin" ? path === "/admin" : path.startsWith(href);
    return match && href.length > best.length ? href : best;
  }, "");

  return (
    <nav className="flex gap-1">
      {NAV.map(([label, href]) => {
        const on = href === active;
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`pressable rounded-full px-3 py-1.5 font-mono text-xs transition-colors ${
              on ? "bg-agent/15 text-agent" : "text-ink-3 hover:bg-bg3 hover:text-ink-1"
            }`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
