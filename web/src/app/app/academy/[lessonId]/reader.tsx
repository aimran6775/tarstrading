"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Lesson, Section } from "@/lib/academy/types";
import LessonChart from "@/components/academy/charts";
import LessonCalc from "@/components/academy/calculators";
import Flashcards from "@/components/academy/flashcards";
import LessonGame from "@/components/academy/games";
import { RuleBuilder, OverfitDemo } from "@/components/academy/backtest";
import PayoffDiagram from "@/components/academy/payoff";

/*
  The lesson reader. Reading measure capped at 68ch, quizzes are interactive
  and honest (wrong answers explain, not shame), the desk section deep-links
  into the terminal, and completion banks XP.
*/

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const },
};

export default function LessonReader({ track, lesson, lessonNumber, trackSize, nextLessonId, nextTrackTitle }: {
  track: { id: string; title: string; accent: string };
  lesson: Lesson;
  lessonNumber: number;
  trackSize: number;
  nextLessonId: string | null;
  nextTrackTitle?: string | null;
}) {
  const quizCount = lesson.sections.filter((s) => s.kind === "quiz").length;
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [xpTotal, setXpTotal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function complete() {
    setSaving(true); setSaveError(false);
    try {
      const res = await fetch("/api/academy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      const data = await res.json();
      if (data.ok) { setCompleted(true); setXpTotal(data.xp); }
      else setSaveError(true);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-0">
      <p className="kicker mb-4">
        <Link href="/app/academy" className="hover:underline">{track.title}</Link>
        {" "}· {lessonNumber} of {trackSize}
      </p>
      <h1 className="display text-3xl text-ink-1 md:text-5xl">{lesson.title}</h1>
      <p className="mt-4 text-lg italic leading-relaxed text-ink-2">{lesson.hook}</p>
      <p className="tnum mt-3 text-xs text-ink-4">{lesson.minutes} min · {lesson.xp} XP</p>

      <div className="mt-10 flex flex-col gap-8">
        {lesson.sections.map((section, i) => (
          <motion.div key={i} {...reveal}>
            <SectionView section={section}
              onAnswered={() => setAnswered((a) => a + 1)}
              onCorrect={() => setCorrect((c) => c + 1)}
              onReset={(wasRight) => { setAnswered((a) => Math.max(0, a - 1)); if (wasRight) setCorrect((c) => Math.max(0, c - 1)); }} />
          </motion.div>
        ))}
      </div>

      <div className="mt-12 border-t border-hairline pt-8">
        {completed ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="tnum text-2xl font-semibold text-gold">+{lesson.xp} XP banked</p>
            {xpTotal != null && <p className="text-sm text-ink-3">Total: {xpTotal} XP</p>}
            {nextLessonId ? (
              <Link href={`/app/academy/${nextLessonId}`}
                className="pressable cta-gold rounded-full px-8 py-3.5 text-base font-semibold">
                {nextTrackTitle ? `Start next track: ${nextTrackTitle}` : "Next lesson"}
              </Link>
            ) : (
              <Link href="/app" className="pressable cta-gold rounded-full px-8 py-3.5 text-base font-semibold">
                To the desk — you&apos;ve finished the academy
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {quizCount > 0 && (
              <p className="tnum text-xs text-ink-4">{correct} of {quizCount} checks correct · {answered}/{quizCount} answered</p>
            )}
            <button onClick={complete} disabled={saving || answered < quizCount}
              className="pressable cta-gold rounded-full px-8 py-3.5 text-base font-semibold disabled:opacity-40">
              {saving ? "Banking XP…" : answered < quizCount ? `Answer the ${quizCount - answered} check${quizCount - answered > 1 ? "s" : ""} to finish` : `Complete lesson · +${lesson.xp} XP`}
            </button>
            {saveError && <p role="alert" className="text-xs text-loss">Couldn&apos;t save your progress. Try again.</p>}
            <Link href="/app/academy" className="text-xs text-ink-3 hover:text-ink-1">
              Back to tracks
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function SectionView({ section, onAnswered, onCorrect, onReset }: {
  section: Section;
  onAnswered: () => void; onCorrect: () => void; onReset: (wasRight: boolean) => void;
}) {
  switch (section.kind) {
    case "prose":
      return <p className="text-[17px] leading-[1.65] text-ink-2">{section.text}</p>;

    case "keyIdea":
      return (
        <div className="card border-l-2 border-l-gold p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">Key idea</p>
          <p className="mt-2 text-base font-semibold text-ink-1">{section.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{section.text}</p>
        </div>
      );

    case "analogy":
      return (
        <div className="rounded-2xl border border-hairline bg-bg2/60 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-4">In plain terms</p>
          <p className="mt-2 text-base font-semibold text-ink-1">{section.title}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{section.text}</p>
        </div>
      );

    case "chart":
      return <LessonChart variant={section.variant} caption={section.caption} />;

    case "calc":
      return <LessonCalc tool={section.tool} title={section.title} />;

    case "flashcards":
      return <Flashcards title={section.title} cards={section.cards} />;

    case "game":
      return <LessonGame variant={section.variant} title={section.title} />;

    case "widget":
      return section.variant === "rule-builder" ? <RuleBuilder />
        : section.variant === "overfit" ? <OverfitDemo />
        : <PayoffDiagram />;

    case "formula":
      return (
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">{section.label}</p>
          <p className="tnum mt-3 overflow-x-auto text-lg text-ink-1">{section.expression}</p>
          <p className="mt-3 text-xs leading-relaxed text-ink-4">{section.legend}</p>
        </div>
      );

    case "quiz":
      return <Quiz section={section} onAnswered={onAnswered} onCorrect={onCorrect} onReset={onReset} />;

    case "desk":
      return (
        <div className="card border-l-2 border-l-gain p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gain">To the desk</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{section.instruction}</p>
          <Link href={section.symbol ? `/app/m/${encodeURIComponent(section.symbol)}` : "/app"}
            className="pressable mt-3 inline-block rounded-full border border-hairline px-4 py-2 text-xs text-ink-1 hover:border-ink-4">
            Open the terminal{section.symbol ? ` · ${section.symbol}` : ""}
          </Link>
        </div>
      );
  }
}

function Quiz({ section, onAnswered, onCorrect, onReset }: {
  section: Extract<Section, { kind: "quiz" }>;
  onAnswered: () => void; onCorrect: () => void; onReset: (wasRight: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  function pick(i: number) {
    setPicked(i);
    onAnswered();
    if (i === section.answer) onCorrect();
  }
  function retry() {
    onReset(picked === section.answer);
    setPicked(null);
  }

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">Check yourself</p>
      <p className="mt-2 text-base font-medium text-ink-1">{section.question}</p>
      <div className="mt-4 flex flex-col gap-2">
        {section.choices.map((choice, i) => {
          const isAnswer = i === section.answer;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => pick(i)}
              className={`pressable rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                !answered
                  ? "border-hairline text-ink-2 hover:border-ink-4 hover:text-ink-1"
                  : isAnswer
                    ? "border-gain/60 bg-gain/10 text-ink-1"
                    : isPicked
                      ? "border-loss/60 bg-loss/10 text-ink-2"
                      : "border-hairline text-ink-4"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className={`text-sm leading-relaxed ${picked === section.answer ? "text-gain" : "text-ink-2"}`}>
            {picked === section.answer ? "Right. " : "Not quite. "}{section.explain}
          </p>
          {picked !== section.answer && (
            <button onClick={retry} className="pressable shrink-0 text-xs text-gold hover:underline">Try again</button>
          )}
        </div>
      )}
    </div>
  );
}
