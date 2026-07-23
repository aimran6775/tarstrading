"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Flashcards from "@/components/academy/flashcards";
import LessonGame from "@/components/academy/games";
import { allTerms, GAMES, type Term } from "@/lib/academy/practice";
import { cardKey } from "@/lib/academy/srs";

/*
  The Practice hub — everything the stages taught, recycled forever.
  Flashcards are scheduled by spaced repetition (due cards surface first), an
  arcade replays the same drills the lessons use, and a server-side daily
  streak rewards coming back. No new content: it all derives from the stages.
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

type ReviewMap = Record<string, { box: number; dueAt: number }>;

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
  const [reviews, setReviews] = useState<ReviewMap>({});
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [playedGame, setPlayedGame] = useState<number | null>(null);

  // Load the server streak + spaced-repetition schedule on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, r] = await Promise.all([
          fetch("/api/academy/streak").then((res) => res.json()),
          fetch("/api/academy/reviews").then((res) => res.json()),
        ]);
        if (!alive) return;
        if (s?.ok) setStreak(s.current ?? 0);
        if (r?.ok) {
          const map: ReviewMap = {};
          for (const row of r.reviews as { cardKey: string; box: number; dueAt: number }[]) {
            map[row.cardKey] = { box: row.box, dueAt: row.dueAt };
          }
          setReviews(map);
          const now = Date.now();
          setDueCount(terms.filter((t) => {
            const rv = map[cardKey(t.front)];
            return !rv || rv.dueAt <= now;
          }).length);
        }
      } catch { /* offline — streak stays 0, deck stays unscheduled */ }
    })();
    return () => { alive = false; };
  }, [terms]);

  function markPracticed() {
    fetch("/api/academy/streak", { method: "POST" })
      .then((res) => res.json())
      .then((d) => { if (d?.ok) setStreak(d.current ?? 0); })
      .catch(() => { /* streak is best-effort */ });
  }

  function recordReview(front: string, got: boolean) {
    const key = cardKey(front);
    // Optimistic: promote/reset locally so a re-shuffle respects this recall.
    setReviews((prev) => {
      const box = got ? Math.min(5, (prev[key]?.box ?? 1) + 1) : 1;
      return { ...prev, [key]: { box, dueAt: got ? Date.now() + box * 86_400_000 : Date.now() } };
    });
    fetch("/api/academy/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardKey: key, got }),
    }).catch(() => { /* best-effort */ });
  }

  const pool: Term[] = stageId === "all" ? terms : terms.filter((t) => t.stageId === stageId);

  // Due (or never-seen) cards first, then the rest by nearest due date — so a
  // session always drills what's slipping before what's fresh.
  const deck = useMemo(() => {
    const now = Date.now();
    const withState = pool.map((t) => ({ t, r: reviews[cardKey(t.front)] }));
    const due = shuffle(withState.filter((x) => !x.r || x.r.dueAt <= now));
    const later = withState
      .filter((x) => x.r && x.r.dueAt > now)
      .sort((a, b) => (a.r!.dueAt - b.r!.dueAt));
    return [...due, ...later].slice(0, SESSION).map((x) => ({ front: x.t.front, back: x.t.back }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, session, reviews]);

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
        Every term and drill from all {stages.length} stages, on repeat. A few minutes a day is how it sticks.
        {dueCount != null && dueCount > 0 && (
          <> <span className="text-gold">{dueCount} card{dueCount === 1 ? "" : "s"} due</span> today.</>
        )}
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
            onRate={recordReview}
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
