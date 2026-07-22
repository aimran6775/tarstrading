import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { tracks, totalXP } from "@/lib/academy";
import Link from "next/link";
import AppNav from "@/components/app-nav";

/*
  Academy home: seven tracks from "what is a market" to "run it like a fund."
  Server-rendered — progress comes with the page, no loading spinners.
*/
export const metadata = { title: "Academy" };

export default async function AcademyHome() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id)).all();
  const done = new Set(rows.map((r) => r.lessonId));
  const xp = rows.reduce((s, r) => s + r.xp, 0);

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
          Seven tracks. Everything a professional desk expects you to know —
          markets, price, risk, margin, options, futures, and the process that
          binds them — taught in plain language, practiced with your simulated
          $100,000. No credential at the end; something better: a book you run
          like you mean it.
        </p>

        <div className="mt-10 flex flex-col gap-5">
          {tracks.map((track, ti) => {
            const completed = track.lessons.filter((l) => done.has(l.id)).length;
            const fraction = completed / track.lessons.length;
            return (
              <section key={track.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">
                      Track {String(ti + 1).padStart(2, "0")} · {track.covers}
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
              </section>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-ink-4">
          Education, not investment advice. The desk is where lessons become skill.
        </p>
      </main>
    </div>
  );
}
