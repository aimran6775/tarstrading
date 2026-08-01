# Academy architecture — review and direction (2026-08-01)

A read of the whole learning system, both surfaces, below the UI.

## What was already right

The bones are better than most learning products ship:

- **Content model** — a lesson is a list of typed blocks (prose, analogy,
  keyIdea, formula, chart, calc, flashcards, game, widget, quiz, desk).
  337 blocks across 13 tracks and 54 lessons. Pedagogy is deliberate:
  analogy first, then prose, then something you DO, then a check.
- **Grading integrity** — the client never asserts a pass. It submits
  answers; the server re-grades against keys it holds and banks XP only if
  every check is right. Answer keys are stripped from the lesson payload.
- **Leitner spaced repetition** — five boxes, widening intervals, one row
  per term keyed by a hash of the card front so the same term met in two
  stages collapses to one schedule.
- **Missions graded against the real book** — not a quiz. The grader reads
  actual positions and stop orders and checks the PROCESS (sized from a
  stop, risk capped), never the outcome.
- **Struggle logging** — every quiz answer stored with tries and
  correctness.

## The four architectural gaps

### 1. ■ Two academies (FIXED this session)
iOS shipped its own 6-track curriculum with its own lesson ids and
**device-local progress with no API call at all**. Finishing a lesson on
the web moved nothing on the phone. Fixed: the server now serves the
course (`/api/academy/curriculum`, `/api/academy/lesson`) and both clients
render it against one progress ledger.

### 2. ■ The retention engine was never fed (FIXED this session)
`card_reviews` — the Leitner table — was only ever written by the Practice
page itself. Completing a lesson did NOT enrol its terms. So the single
most evidence-backed mechanism in the product sat idle for anyone who just
took lessons in order. Fixed: passing a lesson now schedules its cards at
box 1, due immediately, with `onConflictDoNothing` so a term met again
keeps the progress it earned.

### 3. ■ The struggle signal was write-only (FIXED this session)
`quiz_attempts` has logged every answer since the beginning — the schema
comment calls it "the raw material for 'which checks are hard'" — and
**nothing ever read it back**. A learner could miss position sizing in
three separate lessons and be marched on to options regardless. Fixed:
`server/weak-spots.ts` aggregates misses per lesson (counting a right
answer that took several tries as a miss, because a guess that landed is
not understanding) and both clients now surface "Worth another look".

### 4. ▲ Completion is binary — still open
`lesson_progress` records done/not-done. A learner who aced every check
looks identical to one who scraped through on third attempts. There is no
mastery model, so nothing can say "you know sizing cold, but your options
grasp is thin", and nothing can order review by weakness.

**Direction:** derive a per-lesson mastery score from `quiz_attempts`
(first-try correctness), store it alongside completion, and let the
curriculum sort review and unlocks by it. The data is already there.

## Remaining gaps, ranked

1. **Missions on iOS** — 3 missions exist, web-only. This is the mechanic
   that closes learning → doing against a real book. Highest value left.
2. **Only 3 missions for 13 tracks.** The loop is thin. Options, futures,
   margin and psychology tracks have no mission to prove them.
3. **Reviews are surfaced but not yet playable on iOS** — the count shows;
   the card session is still web-only.
4. **Placement is web-only** — a returning trader starts at "what is a
   market".
5. **No market → lesson link.** `CONCEPT_LESSON` exists in lib/academy and
   is unused by the instrument explainer, which now carries 182 profiles
   that could each point at the lesson that teaches them.
6. **Charts, drills and widgets** (41 blocks) are still web-only on iOS.
7. **No cohort/streak pressure on iOS** — `/api/academy/streak` exists.
