import { db } from "@/server/db";
import { sql as dsql } from "drizzle-orm";
import { findLesson } from "@/lib/academy";

/*
  Academy analytics — where learners struggle, so content decisions are made on
  evidence, not guesses. Reads the attempt logs (quiz_attempts, game_attempts)
  and engagement (streaks, spaced-repetition rows). Every check a learner
  submits is graded and logged; this is that raw signal, ranked by pain.
*/
export const metadata = { title: "Academy" };
export const dynamic = "force-dynamic";

type Kpi = {
  completions: number; learners: number; quiz_attempts: number; quiz_pass_pct: number;
  game_attempts: number; game_pass_pct: number; streakers: number; top_streak: number; review_rows: number;
};
type HardCheck = { lesson_id: string; quiz_index: number; attempts: number; misses: number; avg_tries: string };
type Drill = { variant: string; attempts: number; misses: number };

function quizInfo(lessonId: string, quizIndex: number) {
  const f = findLesson(lessonId);
  if (!f) return { title: lessonId, question: `check #${quizIndex + 1}` };
  const quizzes = f.lesson.sections.filter((s) => s.kind === "quiz") as Extract<
    (typeof f.lesson.sections)[number], { kind: "quiz" }>[];
  return { title: f.lesson.title, question: quizzes[quizIndex]?.question ?? `check #${quizIndex + 1}` };
}

export default async function AdminAcademy() {
  const [kpi] = await db.execute<Kpi>(dsql`
    select
      (select count(*)::int from lesson_progress)                                             as completions,
      (select count(distinct user_id)::int from lesson_progress)                              as learners,
      (select count(*)::int from quiz_attempts)                                               as quiz_attempts,
      (select coalesce(round(100.0*sum(correct)/nullif(count(*),0)),0)::int from quiz_attempts) as quiz_pass_pct,
      (select count(*)::int from game_attempts)                                               as game_attempts,
      (select coalesce(round(100.0*sum(correct)/nullif(count(*),0)),0)::int from game_attempts) as game_pass_pct,
      (select count(*)::int from practice_streaks)                                            as streakers,
      (select coalesce(max(current),0)::int from practice_streaks)                            as top_streak,
      (select count(*)::int from card_reviews)                                                as review_rows
  `);

  const hard = await db.execute<HardCheck>(dsql`
    select lesson_id, quiz_index, count(*)::int as attempts,
      sum(case when correct = 0 then 1 else 0 end)::int as misses,
      round(avg(tries)::numeric, 2)::text as avg_tries
    from quiz_attempts
    group by lesson_id, quiz_index
    order by (sum(case when correct = 0 then 1 else 0 end)::float / count(*)) desc, attempts desc
    limit 15
  `);

  const drills = await db.execute<Drill>(dsql`
    select variant, count(*)::int as attempts, sum(case when correct = 0 then 1 else 0 end)::int as misses
    from game_attempts group by variant order by attempts desc
  `);

  const KPIS: [string, string | number, string][] = [
    ["Completions", kpi.completions, `${kpi.learners} learners`],
    ["Quiz checks", kpi.quiz_attempts, `${kpi.quiz_pass_pct}% passed`],
    ["Drills played", kpi.game_attempts, `${kpi.game_pass_pct}% correct`],
    ["On a streak", kpi.streakers, `longest ${kpi.top_streak} days`],
    ["Cards scheduled", kpi.review_rows, "in spaced repetition"],
  ];

  return (
    <>
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Academy</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {KPIS.map(([label, value, sub]) => (
          <div key={label} className="panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
            <p className="tnum mt-1 text-2xl font-semibold text-ink-1">{value}</p>
            <p className="mt-0.5 text-[11px] text-ink-4">{sub}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Hardest checks · ranked by miss rate</h2>
      {hard.length === 0 ? (
        <p className="mt-3 text-sm text-ink-4">No quiz attempts logged yet. Numbers appear as learners answer checks.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
                <th className="py-2 pr-4">Lesson · check</th>
                <th className="py-2 pr-4 text-right">Attempts</th>
                <th className="py-2 pr-4 text-right">Miss rate</th>
                <th className="py-2 text-right">Avg tries</th>
              </tr>
            </thead>
            <tbody>
              {hard.map((h) => {
                const info = quizInfo(h.lesson_id, h.quiz_index);
                const missRate = Math.round((h.misses / h.attempts) * 100);
                return (
                  <tr key={`${h.lesson_id}-${h.quiz_index}`} className="border-b border-hairline/50 align-top">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-ink-1">{info.title}</p>
                      <p className="text-xs text-ink-4">{info.question}</p>
                    </td>
                    <td className="tnum py-2.5 pr-4 text-right text-ink-2">{h.attempts}</td>
                    <td className={`tnum py-2.5 pr-4 text-right font-semibold ${missRate >= 50 ? "text-loss" : missRate >= 25 ? "text-gold" : "text-ink-2"}`}>{missRate}%</td>
                    <td className="tnum py-2.5 text-right text-ink-2">{h.avg_tries}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Drills</h2>
      {drills.length === 0 ? (
        <p className="mt-3 text-sm text-ink-4">No drills played yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {drills.map((d) => {
            const missRate = d.attempts ? Math.round((d.misses / d.attempts) * 100) : 0;
            return (
              <div key={d.variant} className="panel p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">{d.variant}</p>
                <p className="tnum mt-1 text-2xl font-semibold text-ink-1">{d.attempts}</p>
                <p className="mt-0.5 text-[11px] text-ink-4">{missRate}% missed</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-ink-4">
        Live from Postgres. A high miss rate flags a check that&apos;s confusing (or a lesson that under-teaches it) — the raw material for the next content pass.
      </p>
    </>
  );
}
