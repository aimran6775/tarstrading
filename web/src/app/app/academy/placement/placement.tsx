"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLACEMENT_QUESTIONS } from "@/lib/academy/placement-quiz";

/*
  The placement test. Answer six questions; we place you at the first stage
  whose idea you don't already have, and mark everything before it as tested
  out. Honest by design — you skip the reading, not the understanding, and you
  can always go back to any earlier stage.
*/

type Result = { startStage: number; startStageTitle: string; skipped: number };

export default function Placement() {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() => PLACEMENT_QUESTIONS.map(() => null));
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const allAnswered = answers.every((a) => a !== null);

  async function submit() {
    setSaving(true); setError(false);
    try {
      const res = await fetch("/api/academy/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (data.ok) setResult(data);
      else setError(true);
    } catch { setError(true); }
    finally { setSaving(false); }
  }

  if (result) {
    const skippedAll = result.startStage >= PLACEMENT_QUESTIONS.length;
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-0">
        <div className="card border-l-2 border-l-gold p-6 text-center">
          <p className="text-3xl" aria-hidden>🎯</p>
          {result.startStage === 0 ? (
            <>
              <h1 className="display mt-2 text-2xl text-ink-1">Let&apos;s start at the beginning.</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                A couple of the fundamentals tripped, so you&apos;ll get the most from Stage 1. No shame — it&apos;s a fast, interactive
                ramp, and skipping it is how people end up with expensive gaps.
              </p>
            </>
          ) : (
            <>
              <h1 className="display mt-2 text-2xl text-ink-1">
                {skippedAll ? "You know your fundamentals." : `Placed at ${result.startStageTitle}.`}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                You tested out of <span className="text-gold">{result.startStage} stage{result.startStage === 1 ? "" : "s"}</span>
                {" "}({result.skipped} lessons), unlocked and marked as complete — no XP, since you skipped the reading, but they&apos;re
                yours to revisit any time. Jump in at <span className="text-ink-1">{result.startStageTitle}</span>.
              </p>
            </>
          )}
          <button
            onClick={() => { router.push("/app/academy"); router.refresh(); }}
            className="pressable cta-gold mt-5 rounded-full px-6 py-3 text-sm font-semibold">
            Go to the academy
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-0">
      <p className="kicker mb-2">
        <Link href="/app/academy" className="hover:underline">Academy</Link> · Placement
      </p>
      <h1 className="display text-3xl text-ink-1 md:text-4xl">Already know some of this?</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-3">
        Six questions. We&apos;ll place you at the first idea you don&apos;t already have and skip you past the rest —
        you can always go back. Answer honestly; there&apos;s no prize for pretending.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {PLACEMENT_QUESTIONS.map((q, qi) => (
          <div key={qi} className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-4">{q.stage}</p>
            <p className="mt-2 text-base font-medium text-ink-1">{q.prompt}</p>
            <div className="mt-4 flex flex-col gap-2">
              {q.choices.map((choice, ci) => (
                <button key={ci}
                  onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))}
                  aria-pressed={answers[qi] === ci}
                  className={`pressable rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    answers[qi] === ci
                      ? "border-gold/60 bg-gold/10 text-ink-1"
                      : "border-hairline text-ink-2 hover:border-ink-4 hover:text-ink-1"
                  }`}>
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button onClick={submit} disabled={!allAnswered || saving}
          className="pressable cta-gold rounded-full px-8 py-3.5 text-base font-semibold disabled:opacity-40">
          {saving ? "Placing you…" : allAnswered ? "See my placement" : "Answer all six to continue"}
        </button>
        {error && <p role="alert" className="text-xs text-loss">Something went wrong. Try again.</p>}
        <Link href="/app/academy" className="text-xs text-ink-3 hover:text-ink-1">Skip — just start at the beginning</Link>
      </div>
    </main>
  );
}
