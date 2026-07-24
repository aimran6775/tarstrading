"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/*
  The lesson tutor — a patient teacher one tap away, on every lesson. It knows
  which lesson you're reading and what you've personally struggled with, so its
  help is specific. Quick actions get a nervous beginner started; free text does
  the rest. Degrades to lesson-grounded help if the model is offline.
*/

type Msg = { role: "user" | "assistant"; content: string };

const QUICK: [string, string][] = [
  ["Explain simply", "Explain this lesson's main idea as simply as you possibly can."],
  ["Give an example", "Give me one concrete, everyday example of this lesson's idea."],
  ["Quiz me", "Ask me one quick question to check I understand this lesson."],
  ["My weak spots", "Based on the checks I've missed before, what should I focus on?"],
];

export default function LessonTutor({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const rm = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: rm ? "auto" : "smooth" });
  }, [messages, sending, rm]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next); setInput(""); setSending(true);
    try {
      const res = await fetch("/api/academy/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.ok ? data.reply : (data.error || "I couldn't answer that — try rephrasing.") }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't reach the tutor just now. Check your connection and try again." }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="pressable fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-agent/40 bg-bg1/90 px-4 py-2.5 text-sm font-semibold text-ink-1 shadow-lg backdrop-blur hover:border-agent/70"
          aria-label="Ask the lesson tutor">
          <span className="text-agent">✦</span> Ask the tutor
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={rm ? undefined : { opacity: 0 }}
              className="fixed inset-0 z-40 bg-bg0/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0"
              onClick={() => setOpen(false)} aria-hidden />

            <motion.div
              role="dialog" aria-label={`Tutor for ${lessonTitle}`}
              initial={rm ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={rm ? undefined : { opacity: 0, y: 24 }}
              transition={{ duration: rm ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="glass fixed inset-x-3 bottom-3 z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-hairline shadow-2xl md:inset-x-auto md:bottom-5 md:right-5 md:max-h-[70vh] md:w-[26rem]">

              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-agent">✦</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-1">Tutor</p>
                    <p className="text-[11px] text-ink-4">{lessonTitle}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="pressable rounded-full px-2 py-1 text-ink-3 hover:text-ink-1" aria-label="Close tutor">✕</button>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Tutor conversation">
                {messages.length === 0 && (
                  <div className="text-sm leading-relaxed text-ink-3">
                    <p className="text-ink-2">Stuck on anything here? Ask me — I know this lesson and what you&apos;ve found tricky before.</p>
                    <p className="mt-2 text-xs text-ink-4">I teach and explain; I never tell you what to buy or sell.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-agent/15 text-ink-1" : "border border-hairline bg-bg2/60 text-ink-2"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start" aria-live="polite">
                    <div className="rounded-2xl border border-hairline bg-bg2/60 px-3.5 py-2.5 text-sm text-ink-4">Thinking…</div>
                  </div>
                )}
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-hairline px-4 py-3">
                  {QUICK.map(([label, prompt]) => (
                    <button key={label} onClick={() => send(prompt)}
                      className="pressable rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:border-agent/50 hover:text-ink-1">
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-hairline p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef} value={input} rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Ask about this lesson…"
                    className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-hairline bg-bg2 px-3 py-2.5 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-agent/50"
                    aria-label="Ask the tutor" />
                  <button onClick={() => send(input)} disabled={!input.trim() || sending}
                    className="pressable cta-gold shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
