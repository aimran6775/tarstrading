"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/*
  The bell (gap 28).

  Fills, margin calls, dividends, expiries and analyst actions all used to
  happen in complete silence: the only way to learn was to open a page and
  infer it from a number that had changed. For a product whose whole claim is
  transparency, that was the largest honesty gap left.

  It is deliberately quiet — a count, a panel, and a "since you left" digest
  on return. No push, no email: those are consent decisions this platform
  doesn't have permission to make.
*/

type Notice = {
  id: string; kind: string; title: string; body: string | null;
  href: string | null; readAt: number | null; createdAt: number;
};
type Digest = {
  since: number; fills: number;
  notices: Array<{ kind: string; title: string; createdAt: number }>;
};

const KIND_TONE: Record<string, string> = {
  fill: "text-gain",
  margin: "text-loss",
  analyst: "text-agent",
  alert: "text-gold",
  system: "text-ink-3",
};

const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172_800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
};

export default function NotificationBell() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState<Digest | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  const load = useCallback(async () => {
    try {
      // Ask for the digest only on the first load of this mount.
      const res = await fetch(`/api/notifications${first.current ? "?digest=1" : ""}`);
      first.current = false;
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setNotices(data.notifications);
      setUnread(data.unread);
      if (data.digest) setDigest(data.digest);
    } catch { /* the bell is never load-bearing */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, 45_000);
    return () => clearInterval(id);
  }, [load]);

  // Click-away and Escape close the panel; focus returns to the bell.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)
        && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await fetch("/api/notifications", { method: "POST" }).catch(() => {});
    }
  }

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle}
        className="pressable relative flex min-h-10 min-w-10 items-center justify-center rounded-full border border-hairline text-ink-3 hover:text-ink-1"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open} aria-haspopup="dialog">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-on-gold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} role="dialog" aria-label="Notifications"
          className="raised absolute right-0 top-12 z-50 max-h-[420px] w-[min(340px,calc(100vw-2rem))] overflow-y-auto p-1">
          {digest && (
            <div className="m-1 rounded-lg border border-gold/25 bg-gold/8 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-gold">Since you left</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
                {digest.fills > 0
                  ? `${digest.fills} order${digest.fills === 1 ? "" : "s"} filled`
                  : "No fills"}
                {digest.notices.length > 0 && `, ${digest.notices.length} notice${digest.notices.length === 1 ? "" : "s"}`}
                {" "}while you were away.
              </p>
            </div>
          )}
          {notices.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-4">
              Nothing yet. Fills, margin calls and analyst decisions land here.
            </p>
          ) : (
            <ul>
              {notices.map((n) => {
                const row = (
                  <div className={`rounded-lg px-3 py-2.5 ${n.readAt ? "" : "bg-bg2"}`}>
                    <p className={`text-[12px] font-semibold ${KIND_TONE[n.kind] ?? "text-ink-1"}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{n.body}</p>}
                    <p className="tnum mt-1 text-[10px] text-ink-4">{ago(n.createdAt)}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.href
                      ? <Link href={n.href} onClick={() => setOpen(false)} className="block hover:bg-bg2/60">{row}</Link>
                      : row}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
