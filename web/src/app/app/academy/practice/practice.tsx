"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Flashcards from "@/components/academy/flashcards";
import LessonGame from "@/components/academy/games";
import { allTerms, GAMES, type Term } from "@/lib/academy/practice";

/*
  The Practice hub — everything the ten stages taught, recycled forever.
  Flashcards (spaced-ish review across all terms or one stage), an arcade of
  the same drills the lessons use, and a local daily streak so coming back
  feels rewarded. No new content: it all derives from the stages.
*/

const SESSION = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Streak = { last: string; streak: number };
const today = () => new Date().toDateString();
const yesterday = () => new Date(Date.now() - 86_400_000).toDateString();

export default function Practice() {
  const terms = useMemo(() => allTerms(), []);
  const stages = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of terms) if (!seen.has(t.stageId)) seen.set(t.stageId, t.stage);
    return [...seen.entries()];
  }, [terms]);

  const [mode, setMode] = useState<"cards" | "arcade">("cards");
  const [stageId, setStageId] = useState<string>("all");
  const [session, setSession] = useState(0);
  const [streak, setStreak] = useState(0);
  const [playedGame, setPlayedGame] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tars-practice");
      if (raw) setStreak((JSON.parse(raw) as Streak).streak ?? 0);
    } catch { /* first visit */ }
  }, []);

  function markPracticed() {
    try {
      const raw = localStorage.getItem("tars-practice");
      const prev: Streak = raw ? JSON.parse(raw) : { last: "", streak: 0 };
      if (prev.last === today()) return; // already counted today
      const next: Streak = {
        last: today(),
        streak: prev.last === yesterday() ? prev.streak + 1 : 1,
      };
      localStorage.setItem("tars-practice", JSON.stringify(next));
      setStreak(next.streak);
    } catch { /* storage blocked — no streak, no harm */ }
  }

  const pool: Term[] = stageId === "all" ? terms : terms.filter((t) => t.stageId === stageId);
  const deck = useMemo(
    () => shuffle(pool).slice(0, SESSION).map((t) => ({ front: t.front, back: t.back })),
    // reshuffle when stage or session changes
    [stageId, session], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker mb-2">
            <Link href="/app/academy" className="hover:underline">Academy</Link> · Practice
          </p>
          <h1 className="display text-3xl text-ink-1 md:text-4xl">Keep it sharp.</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-bg2 px-3 py-1.5">
          <span className="text-base">🔥</span>
          <span className="tnum text-sm font-semibold text-gold">{streak}</span>
          <span className="text-xs text-ink-4">day{streak === 1 ? "" : "s"}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">
        Every term and drill from the ten stages, on repeat. A few minutes a day is how it sticks.
      </p>

      {/* mode switch */}
      <div className="mt-6 flex gap-1 rounded-full border border-hairline bg-bg1 p-1">
        {([["cards", `Flashcards · ${terms.length}`], ["arcade", `Arcade · ${GAMES.length}`]] as const).map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setPlayedGame(null); }}
            className={`pressable flex-1 rounded-full px-4 py-2 text-sm font-medium ${
              mode === m ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "cards" ? (
        <div className="mt-6 flex flex-col gap-4">
          {/* stage filter */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={stageId === "all"} onClick={() => { setStageId("all"); setSession((s) => s + 1); }}>
              All terms
            </FilterChip>
            {stages.map(([id, title]) => (
              <FilterChip key={id} active={stageId === id} onClick={() => { setStageId(id); setSession((s) => s + 1); }}>
                {title}
              </FilterChip>
            ))}
          </div>

          <Flashcards
            key={`${stageId}-${session}`}
            title={stageId === "all" ? "Mixed review" : stages.find(([id]) => id === stageId)?.[1]}
            cards={deck}
            onDone={markPracticed}
          />

          <button onClick={() => setSession((s) => s + 1)}
            className="pressable mx-auto rounded-full border border-hairline px-5 py-2 text-xs text-ink-2 hover:text-ink-1">
            Shuffle a fresh {SESSION}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          {playedGame == null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((g, i) => (
                <button key={g.variant} onClick={() => { setPlayedGame(i); markPracticed(); }}
                  className="pressable flex flex-col gap-1.5 rounded-2xl border border-hairline bg-bg1 p-4 text-left transition-colors hover:border-agent/40 hover:bg-bg2/60">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-1">
                    <span className="text-agent">▲</span> {g.title}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-4">{g.blurb}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button onClick={() => setPlayedGame(null)}
                className="pressable self-start rounded-full border border-hairline px-4 py-1.5 text-xs text-ink-3 hover:text-ink-1">
                ← All games
              </button>
              <LessonGame variant={GAMES[playedGame].variant} title={GAMES[playedGame].title} />
            </div>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-ink-4">
        Education, not investment advice. Repetition is how knowledge becomes instinct.
      </p>
    </main>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`pressable rounded-full px-3 py-1.5 text-xs font-medium ${
        active ? "bg-gold/15 text-gold" : "border border-hairline text-ink-3 hover:text-ink-1"
      }`}>
      {children}
    </button>
  );
}
