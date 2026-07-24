"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  The analyst chat — you talk, the desk acts. No forms, no dropdowns: describe
  the strategy in plain English and the analyst compiles it into transparent
  rules, backtests on your word, deploys on your word. The whole thread
  persists — your analyst remembers everything.
*/

type Msg = { id: string; role: "user" | "analyst"; text: string; createdAt: number };

const OPENERS = [
  "Hire an analyst that buys NVDA when the 10-day SMA crosses above the 30-day, sells when RSI(14) goes over 70. Give it $10k.",
  "Backtest my newest analyst.",
  "How is the floor doing?",
];

export default function AssistantChat({ onDeskChanged }: { onDeskChanged: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"loading" | "idle" | "thinking" | "error">("loading");
  const scroller = useRef<HTMLDivElement>(null);

  const scrollDown = useCallback(() => {
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/assistant");
        const data = await res.json();
        if (alive && data.ok) { setMessages(data.messages); setPhase("idle"); scrollDown(); }
        else if (alive) setPhase("error");
      } catch { if (alive) setPhase("error"); }
    })();
    return () => { alive = false; };
  }, [scrollDown]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || phase === "thinking") return;
    setInput("");
    setPhase("thinking");
    const now = Date.now();
    setMessages((m) => [...m, { id: `u-${now}`, role: "user", text, createdAt: now }]);
    scrollDown();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "analyst", text: data.reply, createdAt: Date.now() }]);
        if (data.acted) onDeskChanged();
        setPhase("idle");
      } else {
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "analyst", text: data.error ?? "That didn't go through — try again.", createdAt: Date.now() }]);
        setPhase("idle");
      }
    } catch {
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "analyst", text: "Couldn't reach the desk — check your connection and try again.", createdAt: Date.now() }]);
      setPhase("idle");
    }
    scrollDown();
  }

  return (
    <section className="panel flex min-h-[420px] flex-col overflow-hidden lg:h-[calc(100vh-220px)] lg:min-h-[520px]">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Your assistant</h2>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-agent">
          <span className="h-1.5 w-1.5 rounded-full bg-agent" /> On the floor
        </span>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Analyst conversation">
        {phase === "loading" && <div className="skeleton h-24 w-full" />}
        {phase === "error" && (
          <p className="py-8 text-center text-xs text-loss">Couldn&apos;t load the conversation. Refresh to retry.</p>
        )}
        {phase !== "loading" && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-ink-2">
              Tell me what you want and I'll hire an analyst to run it — plain English, your rules. I compile, backtest, and deploy on your word.
            </p>
            <div className="flex flex-col gap-2">
              {OPENERS.map((o) => (
                <button key={o} onClick={() => send(o)}
                  className="pressable rounded-xl border border-hairline px-4 py-2.5 text-left text-xs text-ink-3 hover:text-ink-1">
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-gold/15 text-ink-1"
                : "border border-hairline bg-bg2 text-ink-1"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {phase === "thinking" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl border border-hairline bg-bg2 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 border-t border-hairline p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder="Tell your analyst what to do…"
          className="max-h-32 w-full resize-none rounded-xl border border-hairline bg-bg2 px-4 py-2.5 text-sm text-ink-1 outline-none focus:border-gold"
          aria-label="Message your analyst"
        />
        <button type="submit" disabled={phase === "thinking" || !input.trim()}
          className="pressable cta-gold rounded-xl px-5 text-sm font-semibold disabled:opacity-50">
          Send
        </button>
      </form>
    </section>
  );
}
