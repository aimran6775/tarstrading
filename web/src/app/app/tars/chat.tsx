"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { linkifyLesson } from "@/lib/tars-links";

/*
  The mentor's room. Tars's words float on the room itself (no bubbles —
  reading type, anchored by the orb). Yours sit in quiet gold-washed
  capsules. Memory is visible and honest: you can see exactly what the
  mentor remembers about you.
*/

type Message = { id: string; role: "user" | "tars"; text: string; createdAt: number };
type Brain = { provider: "hf" | "ollama" | "scripted"; model: string };

const OPENERS = [
  "Critique my current book",
  "What's the biggest risk I'm not seeing?",
  "Explain theta like I'm smart but new",
  "Was my last trade a good decision or a good outcome?",
];

export default function TarsChat({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState("");
  const [brain, setBrain] = useState<Brain | null>(null);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/tars");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) { setMessages(data.messages); setMemory(data.memory); setBrain(data.brain); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);
  useEffect(() => {
    if (!thinking) { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [thinking]);

  async function send(text?: string) {
    const clean = (text ?? draft).trim();
    if (!clean || sending.current) return;
    sending.current = true;
    setDraft("");
    setThinking(true);
    // Optimistic append — the room answers at the speed of thought.
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", text: clean, createdAt: Date.now() }]);
    const replyId = `tars-${Date.now()}`;
    try {
      const res = await fetch("/api/tars", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      // First token flips 'thinking' off and mounts the reply bubble; the
      // rest stream straight into it.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let mounted = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!mounted) {
          mounted = true;
          setThinking(false);
          setMessages((m) => [...m, { id: replyId, role: "tars", text: acc, createdAt: Date.now() }]);
        } else {
          setMessages((m) => m.map((msg) => (msg.id === replyId ? { ...msg, text: acc } : msg)));
        }
      }
      sending.current = false;
      setThinking(false);
      if (!mounted) {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "tars",
          text: "I couldn't answer that one — something failed on my end. Try again in a moment.", createdAt: Date.now() }]);
      }
      load(); // refresh canonical history + memory (incl. distilled notes)
    } catch {
      setThinking(false);
      sending.current = false;
      setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "tars",
        text: "We lost the connection mid-thought. Check your network and ask again.", createdAt: Date.now() }]);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-24 pt-8 md:pb-8 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <OrbAvatar thinking={thinking} />
          <div>
            <h1 className="font-display text-lg font-bold text-ink-1">Tars</h1>
            <p className="text-[11px] text-ink-4">
              {thinking ? `thinking${elapsed > 2 ? ` · ${elapsed}s` : "…"}` : "mentor · not a tipster"}
              {brain && brain.provider !== "scripted" && (
                <span className="tnum"> · {brain.model.split("/").pop()}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {memory && (
            <button onClick={() => setShowMemory((s) => !s)}
              className="pressable rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-3 hover:text-ink-1">
              {showMemory ? "Hide memory" : "What Tars remembers"}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={async () => { await fetch("/api/tars", { method: "DELETE" }); load(); }}
              className="pressable rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-3 hover:text-loss">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {showMemory && memory && (
        <div className="card mt-4 border-l-2 border-l-gold p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">The mentor&apos;s notes on you</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{memory}</p>
          <p className="mt-2 text-[10px] text-ink-4">Memory survives cleared chats — mentors don&apos;t forget you between conversations.</p>
        </div>
      )}

      <div className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-16 text-center">
            <OrbAvatar thinking={false} size={56} />
            <p className="max-w-sm text-base leading-relaxed text-ink-2">
              Ask me anything about markets, {userName.split(" ")[0]}.
              I teach. I critique. I remember. I don&apos;t tip.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {OPENERS.map((o) => (
                <button key={o} onClick={() => send(o)}
                  className="pressable rounded-full border border-gold/30 bg-gold/8 px-4 py-2 text-xs text-gold hover:bg-gold/15">
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl bg-gold/12 px-4 py-2.5 text-[15px] leading-relaxed text-ink-1">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-3">
              <OrbAvatar thinking={false} size={24} />
              <p className="flex-1 whitespace-pre-wrap text-[16px] leading-[1.65] text-ink-1">
                <LinkedText text={m.text} />
              </p>
            </div>
          ),
        )}

        {thinking && (
          <div className="flex items-start gap-3">
            <OrbAvatar thinking size={24} />
            <span className="skeleton mt-1.5 h-4 w-40" />
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="glass sticky bottom-0 mt-8 flex items-center gap-2 rounded-full border border-hairline p-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask Tars…  (Shift+Enter for a new line)"
          rows={1}
          className="max-h-32 w-full resize-none bg-transparent px-4 py-2 text-[15px] text-ink-1 outline-none placeholder:text-ink-4"
          aria-label="Message Tars"
        />
        <button type="submit" disabled={!draft.trim() || thinking}
          className="pressable cta-gold shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          Send
        </button>
      </form>
      <p className="mt-3 pb-4 text-center text-[10px] text-ink-4">
        Tars teaches and critiques. It never gives directive advice — that&apos;s the one promise it keeps.
      </p>
    </main>
  );
}

/** Renders Tars prose with the first mention of each concept linked to its
    Academy lesson — every answer becomes a doorway into the curriculum. */
function LinkedText({ text }: { text: string }) {
  const segments = linkifyLesson(text);
  return (
    <>
      {segments.map((seg, i) =>
        "lessonId" in seg ? (
          <Link key={i} href={`/app/academy/${seg.lessonId}`}
            className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold">
            {seg.text}
          </Link>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function OrbAvatar({ thinking, size = 36 }: { thinking: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-0 rounded-full border border-gold/40 bg-gold/8" />
      <span
        className={`absolute rounded-[50%] border border-gold/70 ${thinking ? "animate-spin" : ""}`}
        style={{ width: size * 1.12, height: size * 0.4, animationDuration: thinking ? "1.2s" : undefined }}
      />
      <span className="rounded-full bg-gold" style={{ width: size * 0.14, height: size * 0.14 }} />
    </span>
  );
}
