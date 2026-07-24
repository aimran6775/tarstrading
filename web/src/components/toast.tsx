"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/*
  Global toasts — quiet, glassy, top-right, self-dismissing. Fired for the
  things a trader wants to know happened anywhere in the app: an order filled,
  an agent acted, a lesson banked. Kind maps to the meaning palette.
*/

type Kind = "info" | "gain" | "loss" | "agent";
type Toast = { id: number; kind: Kind; title: string; body?: string };

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const ACCENT: Record<Kind, string> = {
  info: "border-l-gold",
  gain: "border-l-gain",
  loss: "border-l-loss",
  agent: "border-l-agent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((cur) => [...cur, { ...t, id }].slice(-4)); // cap the stack
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-3 top-16 z-[120] flex w-[min(92vw,340px)] flex-col gap-2 md:right-5">
        {toasts.map((t) => (
          <div key={t.id}
            role="status"
            className={`glass pointer-events-auto rounded-xl border border-hairline border-l-2 px-4 py-3 shadow-xl ${ACCENT[t.kind]}`}
            style={{ animation: "toast-in 260ms cubic-bezier(0.32,0.72,0,1)" }}>
            <p className="text-sm font-semibold text-ink-1">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-ink-3">{t.body}</p>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/*
  Watches agent activity in the background (app-wide) and toasts genuinely new
  events — so an agent's fill reaches you on the lesson page or in Tars chat,
  not only on the Agent Lab. Baselines silently on first load (no backlog spam).
*/
export function AgentActivityToasts() {
  const push = useToast();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/agents/activity");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || !data.ok) return;
        const activity: { id: string; agentName: string; text: string }[] = data.activity ?? [];
        if (seen.current === null) {
          seen.current = new Set(activity.map((a) => a.id)); // baseline, no toasts
          return;
        }
        // Oldest-first so a burst toasts in order.
        for (const a of [...activity].reverse()) {
          if (!seen.current.has(a.id)) {
            seen.current.add(a.id);
            push({ kind: "agent", title: a.agentName, body: a.text });
          }
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, [push]);

  return null;
}
