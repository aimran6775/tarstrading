"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MISSIONS, missionById, totalMissionXP, type MissionCheck } from "@/lib/academy/missions";

/*
  The missions hub — where the academy is proven on the desk. Each card grades
  a real (simulated) trade against the process the lessons teach. "Check my
  trade" re-reads your account live; pass the criteria and the mission banks,
  permanently, even after you close the position.
*/

type Graded = { missionId: string; complete: boolean; passed: boolean; checks: MissionCheck[]; justCompleted?: boolean };

export default function Missions({ initialGraded, earnedXP }: { initialGraded: Graded[]; earnedXP: number }) {
  const [graded, setGraded] = useState<Record<string, Graded>>(() =>
    Object.fromEntries(initialGraded.map((g) => [g.missionId, g])));
  const [checking, setChecking] = useState<string | null>(null);

  const earned = useMemo(
    () => MISSIONS.reduce((s, m) => s + (graded[m.id]?.complete ? m.xp : 0), 0),
    [graded]);
  // seed from the server number until the client recomputes
  const shownXP = Object.keys(graded).length ? earned : earnedXP;
  const doneCount = MISSIONS.filter((m) => graded[m.id]?.complete).length;

  async function check(missionId: string) {
    setChecking(missionId);
    try {
      const res = await fetch("/api/academy/missions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (data.ok) setGraded((g) => ({ ...g, [missionId]: data.result }));
    } catch { /* leave the card as-is; the learner can retry */ }
    finally { setChecking(null); }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 md:pb-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker mb-2">
            <Link href="/app/academy" className="hover:underline">Academy</Link> · Missions
          </p>
          <h1 className="display text-3xl text-ink-1 md:text-4xl">Prove it on the desk.</h1>
        </div>
        <p className="tnum text-sm text-ink-3"><span className="text-gold">{shownXP}</span> / {totalMissionXP} XP</p>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
        Reading and quizzes teach the idea. Missions prove you can <em>do</em> it — each one is graded on a real trade
        you place on the desk, judged on process (sized? stopped? risk capped?), never on whether it won.
        {doneCount > 0 && <> You&apos;ve cleared <span className="text-gold">{doneCount}</span> of {MISSIONS.length}.</>}
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {MISSIONS.map((m) => {
          const g = graded[m.id];
          const complete = g?.complete;
          const isChecking = checking === m.id;
          return (
            <section key={m.id}
              className={`card overflow-hidden border-l-2 p-5 ${complete ? "border-l-gold" : "border-l-gain"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ink-1">{m.title}</h2>
                    {complete && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-gold">CLEARED</span>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{m.brief}</p>
                </div>
                <span className="tnum shrink-0 text-xs text-ink-4">+{m.xp} XP</span>
              </div>

              {complete ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-gain">
                  <span aria-hidden>✓</span> {g?.justCompleted ? "Nailed it — mission banked. That's the real skill." : "Mission complete."}
                </p>
              ) : (
                <>
                  {g && g.checks.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {g.checks.map((c, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span aria-hidden className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            c.ok ? "bg-gain/20 text-gain" : "border border-ink-4 text-transparent"
                          }`}>✓</span>
                          <span className={c.ok ? "text-ink-2" : "text-ink-3"}>
                            {c.label}
                            {c.detail && <span className="text-ink-4"> — {c.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 rounded-xl border border-hairline bg-bg2/50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-4">How</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{m.hint}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button onClick={() => check(m.id)} disabled={isChecking}
                      className="pressable cta-gold rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
                      {isChecking ? "Checking your account…" : "Check my trade"}
                    </button>
                    <Link href="/app" className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-2 hover:text-ink-1">
                      Open the desk
                    </Link>
                    <Link href={`/app/academy/${m.lesson}`} className="text-xs text-ink-3 hover:text-gold">
                      Refresher →
                    </Link>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-ink-4">
        Education, not investment advice. Missions grade your process — the one thing you actually control.
      </p>
    </main>
  );
}
