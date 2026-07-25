import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { tracks, totalXP, totalMinutes, unlockedTrackIds } from "@/lib/academy";
import Link from "next/link";
import AppNav from "@/components/app-nav";
import { Icon } from "@/components/icons";
import type { CSSProperties } from "react";

/*
  Academy home: the staged journey from "what is a market" to "run it like a
  fund." Stage 1 is the rebuilt interactive template; the rest upgrade behind
  it. Server-rendered — progress comes with the page, no loading spinners.
*/
export const metadata = { title: "Academy" };

// Derived from the lessons themselves so the pitch can never overstate the
// content: stage count and hours move automatically as the curriculum grows.
const STAGES = tracks.length;
const HOURS = Math.round(totalMinutes / 60);

export default async function AcademyHome() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = await db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id));
  const done = new Set(rows.map((r) => r.lessonId));
  const xp = rows.reduce((s, r) => s + r.xp, 0);
  const allLessons = tracks.flatMap((t) => t.lessons);
  const next = allLessons.find((l) => !done.has(l.id));
  const doneCount = allLessons.filter((l) => done.has(l.id)).length;
  const overall = Math.round((doneCount / allLessons.length) * 100);
  const unlocked = unlockedTrackIds(done);
  const graduated = doneCount === allLessons.length;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-8">
        {/* Hero — the thesis. One bold moment: a lit, gold-threaded plinth
            with an oversized ghost echo and a soft aura behind the type. */}
        <section className="raised edge-gold rise-in relative isolate overflow-hidden px-6 py-8 md:px-9 md:py-10">
          <div className="aura aura-gold" aria-hidden />
          <span aria-hidden className="ghost pointer-events-none absolute -right-2 -top-4 select-none text-[26vw] leading-none md:text-[15rem]">
            01
          </span>
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <p className="kicker">The academy</p>
              <span className="h-px flex-1 bg-hairline" />
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <h1 className="display text-4xl text-ink-1 md:text-5xl">
                Zero to fund manager.
              </h1>
              {/* the gold-block count, jeweled */}
              <span className="tnum inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/8 px-3 py-1.5 text-sm shadow-[inset_0_1px_0_oklch(1_0_0/0.12)]">
                <Icon.GoldBlock className="h-3.5 w-3.5 text-gold" />
                <span className="text-gold lumina">{xp}</span>
                <span className="text-ink-4">/ {totalXP}</span>
                <span className="sr-only">gold blocks earned</span>
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
              {STAGES} stages, about {HOURS} hours, from &ldquo;what is a market&rdquo; to running
              a book like a pro — including the inner game, where most traders
              actually lose. Plain language, an analogy for every idea, and
              something to <em>do</em> on every screen — charts you drive,
              calculators you drag, drills you play. Practiced with your simulated
              $100,000.
            </p>

            {/* overall progress bar — gold gradient with a glowing head */}
            <div className="mt-7 flex items-center gap-3">
              <div className="relative h-2 flex-1 rounded-full bg-bg3">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all duration-700"
                  style={{ width: `${overall}%`, boxShadow: "0 0 12px var(--gold), 0 0 4px var(--gold)" }}
                />
              </div>
              <span className="tnum shrink-0 text-xs text-ink-2">{overall}%</span>
            </div>

            {next && (
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link href={`/app/academy/${next.id}`}
                  className="pressable cta-gold sweep inline-flex max-w-full items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                  {done.size > 0 ? "Continue" : "Start learning"}: {next.title}
                </Link>
                {doneCount === 0 && (
                  <Link href="/app/academy/placement" className="text-sm text-ink-3 hover:text-gold">
                    Already know some of this? Take the placement →
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {graduated && (
          <div className="rise-in mt-6 flex items-center gap-4 rounded-2xl border border-gold/40 bg-gold/8 p-5">
            <Icon.Academy className="h-8 w-8 shrink-0 text-gold" />
            <div>
              <p className="font-display text-lg font-bold text-gold">Academy complete — every stage cleared.</p>
              <p className="mt-0.5 text-sm text-ink-2">
                You&apos;ve been from &ldquo;what is a market&rdquo; to running a book. Now the real teacher is the desk —
                and <Link href="/app/academy/practice" className="text-gold hover:underline">Practice</Link> keeps it sharp.
              </p>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-5">
          {tracks.map((track, ti) => {
            const completed = track.lessons.filter((l) => done.has(l.id)).length;
            const fraction = completed / track.lessons.length;
            const locked = !unlocked.has(track.id);
            const cleared = completed === track.lessons.length;
            return (
              <section
                key={track.id}
                className={`raised lift rise-in overflow-hidden ${locked ? "opacity-60" : ""}`}
                style={{ "--i": ti + 1 } as CSSProperties}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {/* refined stage index — machined mono numeral */}
                    <span
                      className={`tnum grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg ${
                        cleared
                          ? "border-gold/30 bg-gold/10 text-gold"
                          : locked
                            ? "border-hairline bg-bg3/40 text-ink-4"
                            : "border-hairline bg-bg3/40 text-ink-2"
                      }`}
                      aria-hidden
                    >
                      {String(ti + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-ink-4">
                        <span>{track.covers}</span>
                        {cleared && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-gold">CLEARED</span>}
                        {locked && <span className="rounded-full border border-hairline px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-ink-4">LOCKED</span>}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold text-ink-1">{track.title}</h2>
                      <p className="text-sm text-ink-3">{track.tagline}</p>
                    </div>
                  </div>
                  <div className="relative h-12 w-12 shrink-0" aria-label={`${completed} of ${track.lessons.length} lessons complete`}>
                    <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg3)" strokeWidth="3.5" />
                      <circle cx="24" cy="24" r="20" fill="none"
                        stroke={`var(--${track.accent})`} strokeWidth="3.5"
                        strokeDasharray={`${fraction * 125.7} 125.7`} strokeLinecap="round" />
                    </svg>
                    <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] text-ink-2">
                      {completed}/{track.lessons.length}
                    </span>
                  </div>
                </div>
                {locked ? (
                  <p className="px-5 py-4 text-xs text-ink-4">
                    Clear <span className="text-ink-2">Stage {ti}</span> to unlock this stage — the ideas here build on it.
                  </p>
                ) : (
                  <ul>
                    {track.lessons.map((lesson) => {
                      const isDone = done.has(lesson.id);
                      return (
                        <li key={lesson.id}>
                          <Link
                            href={`/app/academy/${lesson.id}`}
                            className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-bg3/40"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                  isDone
                                    ? "border-transparent bg-gold text-ongold"
                                    : "border-hairline text-transparent group-hover:border-ink-3"
                                }`}
                              >
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor"
                                  strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12.5 L10 17.5 L19 7" />
                                </svg>
                              </span>
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-medium ${isDone ? "text-ink-2" : "text-ink-1"}`}>{lesson.title}</p>
                                <p className="truncate text-xs text-ink-4">{lesson.hook}</p>
                              </div>
                            </div>
                            <span className="tnum flex shrink-0 items-center gap-2 text-[11px] text-ink-4">
                              <span>{lesson.minutes}m</span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-gold">
                                <Icon.GoldBlock className="h-3 w-3" />
                                {lesson.xp}
                                <span className="sr-only">gold blocks</span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Missions — prove the lessons with real trades on the desk */}
        <Link href="/app/academy/missions"
          className="pressable raised lift rise-in mt-6 flex items-center justify-between gap-4 p-5 hover:border-gain/40">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">Prove it on the desk</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold text-ink-1">Missions <Icon.Target className="h-5 w-5 text-gain" /></h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Graded challenges you complete with a real trade — sized, stopped, heat under control. Judged on process, never profit.
            </p>
          </div>
          <span className="shrink-0 text-2xl text-ink-4">→</span>
        </Link>

        {/* Historical replay — trade famous market moments blind */}
        <Link href="/app/academy/replay"
          className="pressable raised lift rise-in mt-6 flex items-center justify-between gap-4 p-5 hover:border-agent/40">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">Trade history blind</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold text-ink-1">Replay <Icon.Chart className="h-5 w-5 text-agent" /></h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Step into the COVID crash, the 2022 bear, or the GameStop squeeze — one day at a time — and feel the decisions for real.
            </p>
          </div>
          <span className="shrink-0 text-2xl text-ink-4">→</span>
        </Link>

        {/* Practice hub — the endless review loop after (and during) the stages */}
        <Link href="/app/academy/practice"
          className="pressable raised lift rise-in mt-6 flex items-center justify-between gap-4 p-5 hover:border-gold/40">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">Beyond the stages</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold text-ink-1">Practice <Icon.Flame className="h-5 w-5 text-gold" /></h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Every term and drill on repeat — flashcards, the arcade, and a daily streak. A few minutes keeps it sharp.
            </p>
          </div>
          <span className="shrink-0 text-2xl text-ink-4">→</span>
        </Link>

        <p className="mt-10 text-center text-xs text-ink-4">
          Education, not investment advice. The desk is where lessons become skill.
        </p>
      </main>
    </div>
  );
}
