import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq, lte, asc } from "drizzle-orm";
import { allLessons } from "@/lib/academy";
import { cardKey } from "@/lib/academy/srs";

/*
  A review session, ready to play.

  card_reviews stores a HASH of each card's front text — deliberately, so
  the same term met in two stages shares one schedule. But that meant no
  client could render a session: the reviews endpoint returned keys and
  boxes, and a key is not a question.

  This resolves the schedule back into actual cards, oldest-due first, and
  hands over only what a session needs. The index is built once from the
  curriculum, which is the same source the enrolment hashes against, so a
  key can only fail to resolve if the content that created it was deleted
  — and those are skipped rather than shown as blanks.
*/
export const dynamic = "force-dynamic";

const MAX_CARDS = 20;

/** front-hash → the card, plus where it came from. */
function buildIndex() {
  const index = new Map<string, { front: string; back: string; lessonId: string; lessonTitle: string }>();
  for (const lesson of allLessons) {
    for (const sec of lesson.sections) {
      if (sec.kind !== "flashcards") continue;
      for (const c of sec.cards) {
        const k = cardKey(c.front);
        // First definition wins: a term introduced early keeps its
        // original phrasing rather than being restated by a later stage.
        if (!index.has(k)) {
          index.set(k, { front: c.front, back: c.back, lessonId: lesson.id, lessonTitle: lesson.title });
        }
      }
    }
  }
  return index;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const now = Date.now();
  const due = await db.select().from(schema.cardReviews)
    .where(and(
      eq(schema.cardReviews.userId, user.id),
      lte(schema.cardReviews.dueAt, now),
    ))
    .orderBy(asc(schema.cardReviews.dueAt))
    .limit(MAX_CARDS * 2);   // headroom for keys whose content has gone

  const index = buildIndex();
  const cards = due
    .map((r) => {
      const card = index.get(r.cardKey);
      if (!card) return null;
      return {
        cardKey: r.cardKey,
        front: card.front,
        back: card.back,
        lessonId: card.lessonId,
        lessonTitle: card.lessonTitle,
        box: r.box,
        lapses: r.lapses,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_CARDS);

  // How many are waiting beyond this session, so the UI can be honest
  // about whether finishing clears the queue.
  const remaining = Math.max(0, due.length - cards.length);

  return NextResponse.json({ ok: true, cards, remaining });
}
