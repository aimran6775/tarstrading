/*
  When Tars explains a concept, link the first mention to the lesson that
  teaches it — so a chat answer becomes a doorway into the academy. Terms are
  matched case-insensitively on word boundaries; the first hit per term wins.
  Ordered longest-first so "position sizing" beats "position".
*/

export type LinkTerm = { term: RegExp; lessonId: string };

export const LESSON_TERMS: LinkTerm[] = [
  { term: /\bposition sizing\b/i, lessonId: "r1-sizing" },
  { term: /\bexpectancy\b/i, lessonId: "r2-expectancy" },
  { term: /\bdrawdowns?\b/i, lessonId: "r3-drawdown" },
  { term: /\bcorrelations?\b/i, lessonId: "r4-correlation" },
  { term: /\bR[- ]?multiples?\b/i, lessonId: "r2-expectancy" },
  { term: /\bshort(ing|s|ed)?\b/i, lessonId: "s2-shorting" },
  { term: /\bmargin\b/i, lessonId: "s3-margin" },
  { term: /\bleverage[d]?\b/i, lessonId: "s3-margin" },
  { term: /\bearnings\b/i, lessonId: "s4-catalysts" },
  { term: /\bimplied volatility\b/i, lessonId: "o2-value" },
  { term: /\bIV crush\b/i, lessonId: "o2-value" },
  { term: /\bthe greeks\b/i, lessonId: "o3-delta-gamma" },
  { term: /\b(delta|gamma)\b/i, lessonId: "o3-delta-gamma" },
  { term: /\b(theta|vega)\b/i, lessonId: "o4-theta-vega" },
  { term: /\bspreads?\b/i, lessonId: "o5-spreads" },
  { term: /\bcall(s)?\b/i, lessonId: "o1-contracts" },
  { term: /\bput(s)?\b/i, lessonId: "o1-contracts" },
  { term: /\bfutures?\b/i, lessonId: "fu1-mechanics" },
  { term: /\bhedg(e|ing|es)\b/i, lessonId: "fu2-hedging" },
  { term: /\bcontango\b/i, lessonId: "fu3-curve" },
  { term: /\bcarry\b/i, lessonId: "fu3-curve" },
  { term: /\b(interest rates?|the dollar|macro)\b/i, lessonId: "fu4-macro" },
  { term: /\b(gross|net) exposure\b/i, lessonId: "h1-portfolio" },
  { term: /\bout[- ]of[- ]sample\b/i, lessonId: "h3-agents" },
  { term: /\boverfit(ting|ted)?\b/i, lessonId: "h3-agents" },
  { term: /\bthes(is|es)\b/i, lessonId: "h2-process" },
  { term: /\bcandles?(ticks?)?\b/i, lessonId: "f3-candles" },
  { term: /\bsupport\b|\bresistance\b/i, lessonId: "p2-levels" },
  { term: /\bvolume\b/i, lessonId: "p3-volume" },
  { term: /\btrend\b/i, lessonId: "p1-trend-structure" },
  { term: /\bspread\b/i, lessonId: "f1-what-a-market-is" },
  { term: /\blimit order\b|\bstop order\b|\bmarket order\b/i, lessonId: "f2-orders" },
];

export type Segment = { text: string } | { text: string; lessonId: string };

/** Split text into plain and linked segments — each linkable term links once. */
export function linkifyLesson(text: string): Segment[] {
  const used = new Set<string>();
  // Find the earliest match across all still-unused terms, repeatedly.
  const segments: Segment[] = [];
  let rest = text;

  for (;;) {
    let best: { index: number; length: number; lessonId: string } | null = null;
    for (const { term, lessonId } of LESSON_TERMS) {
      if (used.has(lessonId)) continue;
      const re = new RegExp(term.source, "i");
      const m = re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, length: m[0].length, lessonId };
      }
    }
    if (!best) { segments.push({ text: rest }); break; }
    used.add(best.lessonId);
    if (best.index > 0) segments.push({ text: rest.slice(0, best.index) });
    segments.push({ text: rest.slice(best.index, best.index + best.length), lessonId: best.lessonId });
    rest = rest.slice(best.index + best.length);
  }
  return segments;
}
