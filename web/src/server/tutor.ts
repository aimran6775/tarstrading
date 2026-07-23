import "server-only";
import { db } from "@/server/db";
import { sql as dsql } from "drizzle-orm";
import { callModel, type ChatMsg } from "@/server/llm";
import { findLesson } from "@/lib/academy";
import type { Lesson } from "@/lib/academy/types";

/*
  The lesson tutor — a patient, plain-spoken teacher that lives inside a lesson.
  It's grounded in THIS lesson's own material and in what the learner has
  personally struggled with (from their graded checks), so its help is specific,
  not generic. Hard rule, enforced in the prompt: it teaches, explains, and
  critiques reasoning — it NEVER gives directive trading advice.
*/

export type TutorMsg = { role: "user" | "assistant"; content: string };

/** A compact, factual digest of the lesson for the model to teach from. */
function lessonContext(lesson: Lesson): string {
  const parts: string[] = [`Lesson: "${lesson.title}". ${lesson.hook}`];
  for (const s of lesson.sections) {
    if (s.kind === "keyIdea") parts.push(`Key idea — ${s.title}: ${s.text}`);
    else if (s.kind === "analogy") parts.push(`Analogy — ${s.title}: ${s.text}`);
    else if (s.kind === "formula") parts.push(`Formula — ${s.label}: ${s.expression} (${s.legend})`);
  }
  // A couple of prose lines add context without bloating the prompt.
  const prose = lesson.sections.filter((s) => s.kind === "prose").slice(0, 2).map((s) => (s as { text: string }).text);
  return [...parts, ...prose].join("\n").slice(0, 1800);
}

/** The learner's most-missed checks across the academy — so the tutor can target
    real weak spots, not guess. Empty for a spotless record. */
async function weakSpots(userId: string): Promise<string> {
  const rows = await db.execute<{ lesson_id: string; quiz_index: number; misses: number }>(dsql`
    select lesson_id, quiz_index, sum(case when correct = 0 then 1 else 0 end)::int as misses
    from quiz_attempts where user_id = ${userId}
    group by lesson_id, quiz_index
    having sum(case when correct = 0 then 1 else 0 end) > 0
    order by misses desc limit 3
  `);
  if (rows.length === 0) return "";
  const items = rows.map((r) => {
    const f = findLesson(r.lesson_id);
    const quizzes = f?.lesson.sections.filter((s) => s.kind === "quiz") ?? [];
    const q = quizzes[r.quiz_index] as { question?: string } | undefined;
    return q?.question ? `- "${q.question}" (missed ${r.misses}×)` : null;
  }).filter(Boolean);
  return items.length ? `This learner has previously struggled with:\n${items.join("\n")}` : "";
}

const SYSTEM = (ctx: string, weak: string) => `You are the Tars tutor: a patient, plain-spoken trading teacher embedded inside an academy lesson. You help ONE learner understand THIS lesson.

RULES (never break):
- You TEACH, EXPLAIN, and CRITIQUE reasoning. You NEVER give directive trading advice — never tell them to buy or sell any specific asset, never predict prices, never make performance claims.
- Keep answers short: 2–4 sentences, plain language, concrete. Prefer an example or analogy over jargon.
- Ground your help in THIS lesson's material below. If asked something unrelated to learning to trade, gently steer back.
- All trading here is simulated practice money. Be encouraging and honest; never shame a wrong answer.

LESSON MATERIAL:
${ctx}
${weak ? `\n${weak}\nIf relevant, gently connect your explanation to these weak spots.` : ""}`;

/** A useful reply even when no model is configured (or it fails) — grounded in
    the lesson so the tutor is never dead weight. */
function fallback(lesson: Lesson, lastUser: string): string {
  const wantsQuiz = /quiz|test|ask me|question/i.test(lastUser);
  if (wantsQuiz) {
    const quiz = lesson.sections.find((s) => s.kind === "quiz") as
      { question?: string; choices?: string[] } | undefined;
    if (quiz?.question) {
      return `Here's a check on this lesson:\n\n${quiz.question}\n${(quiz.choices ?? []).map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("\n")}\n\nTake your best guess — the answer's in the lesson.`;
    }
  }
  const idea = lesson.sections.find((s) => s.kind === "keyIdea") as { title?: string; text?: string } | undefined;
  const base = idea?.text
    ? `The live tutor isn't connected right now, but here's the heart of this lesson — ${idea.title}: ${idea.text}`
    : `The live tutor isn't connected right now. Re-read the key idea above, then try the check — that's where it clicks.`;
  return base;
}

/** Produce the tutor's next reply. `grounded` is false when it fell back. */
export async function tutorReply(userId: string, lessonId: string, messages: TutorMsg[]): Promise<{ reply: string; grounded: boolean }> {
  const found = findLesson(lessonId);
  if (!found) return { reply: "I can't find that lesson — try reopening it.", grounded: false };

  const ctx = lessonContext(found.lesson);
  const weak = await weakSpots(userId).catch(() => "");

  const trimmed = messages.slice(-10).map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  const chat: ChatMsg[] = [{ role: "system", content: SYSTEM(ctx, weak) }, ...trimmed];

  const out = await callModel(chat, 320);
  if (out && out.trim()) return { reply: out.trim(), grounded: true };

  const lastUser = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";
  return { reply: fallback(found.lesson, lastUser), grounded: false };
}
