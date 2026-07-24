import { db } from "@/server/db";
import { sql as dsql } from "drizzle-orm";
import { findLesson } from "@/lib/academy";
import { PageHeader, StatCard, SectionHeader, DataTable } from "../ui";

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

  const pct = (miss: number, att: number) => att ? Math.round((miss / att) * 100) : 0;

  return (
    <>
      <PageHeader title="Academy" right={<span className="font-mono text-[11px] text-ink-4">learning analytics</span>} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Completions" value={kpi.completions} sub={`${kpi.learners} learners`} tone="accent" />
        <StatCard label="Quiz checks" value={kpi.quiz_attempts} sub={`${kpi.quiz_pass_pct}% passed`} tone={kpi.quiz_pass_pct >= 70 ? "gain" : kpi.quiz_pass_pct > 0 ? "warn" : "default"} />
        <StatCard label="Drills played" value={kpi.game_attempts} sub={`${kpi.game_pass_pct}% correct`} tone={kpi.game_pass_pct >= 70 ? "gain" : kpi.game_pass_pct > 0 ? "warn" : "default"} />
        <StatCard label="On a streak" value={kpi.streakers} sub={`longest ${kpi.top_streak} days`} />
        <StatCard label="Cards scheduled" value={kpi.review_rows} sub="in spaced repetition" />
      </div>

      <SectionHeader right={<span className="font-mono text-[11px] text-ink-4">ranked by miss rate</span>}>Hardest checks</SectionHeader>
      <DataTable
        empty="No quiz attempts logged yet — numbers appear as learners answer checks."
        minWidth={640}
        cols={[{ label: "Lesson · check" }, { label: "Attempts", align: "right" }, { label: "Miss rate", align: "right" }, { label: "Avg tries", align: "right" }]}
        rows={hard.map((h) => {
          const info = quizInfo(h.lesson_id, h.quiz_index);
          const missRate = pct(h.misses, h.attempts);
          return [
            <div key="l"><p className="font-medium text-ink-1">{info.title}</p><p className="text-[11px] text-ink-4">{info.question}</p></div>,
            h.attempts,
            <span key="m" className={`font-semibold ${missRate >= 50 ? "text-loss" : missRate >= 25 ? "text-gold" : "text-ink-2"}`}>{missRate}%</span>,
            h.avg_tries,
          ];
        })}
      />

      <SectionHeader>Drills</SectionHeader>
      {drills.length === 0 ? (
        <p className="mt-2 text-sm text-ink-4">No drills played yet.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          {drills.map((d) => {
            const missRate = pct(d.misses, d.attempts);
            return <StatCard key={d.variant} label={d.variant} value={d.attempts} sub={`${missRate}% missed`} tone={missRate >= 50 ? "loss" : missRate >= 25 ? "warn" : "default"} />;
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-ink-4">
        Live from Postgres. A high miss rate flags a check that&apos;s confusing (or a lesson that under-teaches it) — the raw material for the next content pass.
      </p>
    </>
  );
}
