/*
  Historical replay scenarios — trade a famous market moment bar by bar, blind
  to the future, then see how it really played out.

  On honesty: the current market-data plan can't reach this far back, so these
  series are RECONSTRUCTIONS — deterministic paths pinned to the real,
  documented waypoints of each episode (the actual peak and trough dates and
  price levels). The shape, magnitude, and emotional arc are faithful; the
  intraday wiggles are generated, not tick-for-tick history. The UI says so.

  Everything here is pure and deterministic (a seeded PRNG), so every learner
  replays the exact same bars, and server and client agree without shipping data.
*/

export type Bar = { t: number; o: number; h: number; l: number; c: number };

export type Scenario = {
  id: string;
  title: string;
  symbol: string;
  era: string;
  /** One-line hook shown on the card. */
  hook: string;
  /** The situation the learner is dropped into (no spoilers about the outcome). */
  setup: string;
  /** The real story + the lesson, revealed only at the debrief. */
  debrief: string;
  xp: number;
  startPrice: number;
  bars: Bar[];
};

// ---- deterministic generator ---------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

type Waypoint = [day: number, close: number];

/** Build a daily OHLC series that log-interpolates between real waypoints and
    adds seeded noise, pinning each waypoint to its true price. */
function generate(id: string, startISO: string, waypoints: Waypoint[], vol: number): Bar[] {
  const rand = mulberry32(hash(id));
  const startMs = Date.parse(startISO + "T00:00:00Z");
  const lastDay = waypoints[waypoints.length - 1][0];

  const closes: number[] = [];
  for (let d = 0; d <= lastDay; d++) {
    let wi = 0;
    while (wi < waypoints.length - 1 && waypoints[wi + 1][0] < d) wi++;
    const [d0, p0] = waypoints[wi];
    const [d1, p1] = waypoints[Math.min(wi + 1, waypoints.length - 1)];
    const frac = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
    const base = Math.exp(Math.log(p0) + (Math.log(p1) - Math.log(p0)) * frac);
    closes.push(base * (1 + (rand() - 0.5) * 2 * vol));
  }
  for (const [d, p] of waypoints) if (d < closes.length) closes[d] = p;

  const bars: Bar[] = [];
  for (let d = 0; d < closes.length; d++) {
    const c = closes[d];
    const o = d === 0 ? c * (1 + (rand() - 0.5) * vol) : closes[d - 1];
    const hi = Math.max(o, c) * (1 + rand() * vol * 0.7);
    const lo = Math.min(o, c) * (1 - rand() * vol * 0.7);
    bars.push({ t: Math.floor((startMs + d * 86_400_000) / 1000), o: r2(o), h: r2(hi), l: r2(lo), c: r2(c) });
  }
  return bars;
}

// ---- the scenarios --------------------------------------------------------

export const SCENARIOS: Scenario[] = [
  {
    id: "covid-crash",
    title: "The COVID Crash",
    symbol: "SPY",
    era: "Feb–Apr 2020",
    hook: "The fastest bear market in history. You're long the S&P at its all-time high. Then the world stops.",
    setup: "It's February 2020. The S&P 500 (SPY) just printed a record high near $339 — the calm before a storm nobody has priced in. You're holding, feeling good. Play it forward one day at a time and decide: hold, sell, or buy the fear.",
    debrief: "That was the COVID crash — the S&P fell about 34% in just 33 days, the fastest bear market ever. Then it did the other unthinkable thing: it recovered the entire loss within five months. The traders who panic-sold near the $219 bottom locked in the worst possible outcome; the ones who did nothing were whole again by August. The lesson isn't 'buy the bottom' (nobody rings a bell there) — it's that reacting to fear is usually the mistake, and a position you sized to survive is a position you can hold through the storm.",
    xp: 100,
    startPrice: 339,
    bars: generate("covid-crash", "2020-02-19", [[0, 339], [6, 297], [12, 275], [16, 240], [20, 228], [23, 219], [27, 246], [34, 264], [44, 290]], 0.018),
  },
  {
    id: "bear-2022",
    title: "The 2022 Grind",
    symbol: "SPY",
    era: "Jan–Oct 2022",
    hook: "No crash, just a year of slow bleeding — and a dozen rallies that begged you to buy back in.",
    setup: "It's January 2022 and the S&P just made a new high near $479. Inflation is running hot and rates are about to rise. This won't be a crash — it'll be a slow, grinding decline punctuated by sharp rallies that feel like the bottom. Each one is a test. Trade it forward.",
    debrief: "2022 was a bear market of attrition — the S&P ground down about 25% over ten months, but never in a straight line. It staged several ferocious 'bear market rallies' (spring, midsummer) that sucked in buyers convinced the bottom was in, then rolled over to new lows near $357 in October. The lesson: in a downtrend, rallies are for reducing risk, not chasing. The trader who kept heat low and didn't fall for every bounce survived with capital to deploy when it actually turned.",
    xp: 100,
    startPrice: 479,
    bars: generate("bear-2022", "2022-01-03", [[0, 479], [8, 452], [16, 422], [22, 462], [28, 411], [34, 386], [40, 366], [45, 413], [50, 388], [56, 357]], 0.015),
  },
  {
    id: "gme-squeeze",
    title: "The GameStop Squeeze",
    symbol: "GME",
    era: "Jan–Feb 2021",
    hook: "A dying retailer goes to the moon on a short squeeze. Mania in real time — and the crash that always follows.",
    setup: "It's January 2021. GameStop — a struggling mall retailer — is trading in the teens, but a crowd of retail traders has noticed it's heavily shorted. Something strange is starting. You're watching it climb. What do you do as the frenzy builds? Trade it forward, one day at a time.",
    debrief: "This was the GameStop short squeeze — one of the wildest manias in market history. GME rocketed from ~$17 to an intraday $483 in three weeks as a short squeeze fed on itself, then collapsed almost as fast once brokers restricted buying and the momentum broke. The people who bought the top near $300–400 — chasing a story, terrified of missing out — were down 80–90% within weeks. The lesson is not 'find the next meme.' It's that FOMO is the most expensive emotion in trading, parabolas end in tears, and 'this time is different' is the most costly phrase in finance.",
    xp: 100,
    startPrice: 17,
    bars: generate("gme-squeeze", "2021-01-04", [[0, 17], [6, 20], [10, 35], [12, 65], [14, 148], [15, 347], [16, 194], [18, 90], [22, 60], [26, 46], [30, 40]], 0.05),
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
export const totalReplayXP = SCENARIOS.reduce((s, x) => s + x.xp, 0);
