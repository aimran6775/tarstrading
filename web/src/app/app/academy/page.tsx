import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { tracks, totalXP, totalMinutes, unlockedTrackIds } from "@/lib/academy";
import Link from "next/link";
import AppNav from "@/components/app-nav";

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
        <p className="kicker mb-3">The academy</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-4xl text-ink-1 md:text-5xl">
            Zero to fund manager.
          </h1>
          <p className="tnum text-sm text-ink-3">
            <span className="text-gold">{xp}</span> / {totalXP} XP
          </p>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          {STAGES} stages, about {HOURS} hours, from &ldquo;what is a market&rdquo; to running
          a book like a pro — including the inner game, where most traders
          actually lose. Plain language, an analogy for every idea, and
          something to <em>do</em> on every screen — charts you drive,
          calculators you drag, drills you play. Practiced with your simulated
          $100,000.
        </p>

        {/* overall progress bar */}
        <div className="mt-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${overall}%` }} />
          </div>
          <span className="tnum shrink-0 text-xs text-ink-3">{overall}%</span>
        </div>

        {next && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href={`/app/academy/${next.id}`}
              className="pressable cta-gold inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
              {done.size > 0 ? "Continue" : "Start learning"}: {next.title}
            </Link>
            {doneCount === 0 && (
              <Link href="/app/academy/placement" className="text-sm text-ink-3 hover:text-gold">
                Already know some of this? Take the placement →
              </Link>
            )}
          </div>
        )}

        {graduated && (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-gold/40 bg-gold/8 p-5">
            <span className="text-3xl" aria-hidden>🎓</span>
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
              <section key={track.id} className={`card overflow-hidden ${locked ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">
                      Stage {ti + 1} · {track.covers}
                      {cleared && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-gold">CLEARED</span>}
                      {locked && <span className="ml-2 rounded-full border border-hairline px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-ink-4">LOCKED</span>}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink-1">{track.title}</h2>
                    <p className="text-sm text-ink-3">{track.tagline}</p>
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
                    {track.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/app/academy/${lesson.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-bg3/40"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                done.has(lesson.id)
                                  ? "border-transparent bg-gold text-ongold"
                                  : "border-hairline text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <div>
                              <p className="text-sm font-medium text-ink-1">{lesson.title}</p>
                              <p className="text-xs text-ink-4">{lesson.hook}</p>
                            </div>
                          </div>
                          <span className="tnum shrink-0 text-[11px] text-ink-4">
                            {lesson.minutes}m · {lesson.xp}xp
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Practice hub — the endless review loop after (and during) the stages */}
        <Link href="/app/academy/practice"
          className="pressable mt-6 flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-bg1 p-5 transition-colors hover:border-gold/40 hover:bg-bg2/60">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">Beyond the stages</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink-1">Practice 🔥</h2>
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
