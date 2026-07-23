import type { Track } from "./types";

/*
  Stage 2 — Reading Price. Charts stop being wallpaper. Timeframes, trend
  structure, support/resistance & breakouts, and the moving-average crossover —
  each taught with a chart you drive and a drill you play.
*/

export const readingTrack: Track = {
  id: "s2-reading",
  title: "Reading Price",
  tagline: "Timeframes, trend, levels, and moving averages — how a chart tells you what the crowd is doing.",
  covers: "charts & structure",
  accent: "gain",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "p1-timeframes",
      title: "Timeframes: the same story at different zoom",
      hook: "A stock can be crashing on the 5-minute and soaring on the 1-year. Both are true.",
      minutes: 12,
      xp: 70,
      sections: [
        { kind: "analogy", title: "A chart is a map, and timeframe is the zoom",
          text: "Zoom all the way in and you see every pothole — the jitters, the noise. Zoom out and you see the highway — the real direction. Neither is wrong; they answer different questions. Day traders live on the potholes; investors watch the highway." },
        { kind: "prose", text: "Every chart has a timeframe: each candle is one slice of time. On a 1-day chart, each candle is a whole day. On a 5-minute chart, each candle is five minutes. Same stock, same truth — just a different resolution. The mistake beginners make is reacting to noise on a tiny timeframe as if it were the trend." },
        { kind: "chart", variant: "candle-anatomy",
          caption: "Whatever the timeframe, each candle still holds the same four numbers — open, high, low, close." },
        { kind: "keyIdea", title: "Pick a timeframe that matches your patience",
          text: "If you can't watch the screen all day, don't trade the 1-minute. Your timeframe should match how often you can actually make decisions. Mismatch that and the noise will shake you out of good trades." },
        { kind: "quiz",
          question: "On a 1-hour chart, how much time does a single candle represent?",
          choices: ["One minute", "One hour", "One day", "It depends on the stock"],
          answer: 1,
          explain: "The timeframe names the candle. A 1-hour chart draws one candle per hour — its open is the price at the start of the hour, its close is the price 60 minutes later." },
        { kind: "desk", instruction: "Open a chart and flip between 1D, 3M, and 1Y. Watch the same stock go from chaotic to calm. That's timeframe doing its work.", symbol: "TSLA" },
        { kind: "flashcards", title: "Review",
          cards: [
            { front: "Timeframe", back: "The slice of time each candle represents (1m, 1h, 1d, …)." },
            { front: "Noise", back: "Small, meaningless price wiggles — louder on short timeframes." },
            { front: "The trend", back: "The dominant direction, clearest when you zoom out." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "p2-trend",
      title: "Trend is your friend",
      hook: "Markets do only three things. Knowing which one you're in is most of the battle.",
      minutes: 13,
      xp: 80,
      sections: [
        { kind: "prose", text: "Price is never random for long — it organizes into structure. There are only three states: uptrend, downtrend, and range. Uptrends make higher highs and higher lows: each rally goes further, each dip stops higher. Downtrends do the opposite. Ranges just bounce between a floor and a ceiling, going nowhere." },
        { kind: "chart", variant: "trend",
          caption: "Toggle the three. Notice how an uptrend's lows keep rising — that rising floor is buyers refusing to sell cheaper." },
        { kind: "keyIdea", title: "Trade with the trend, not against it",
          text: "Fighting a strong trend is the most expensive habit in trading. In an uptrend, dips are opportunities; in a downtrend, rallies are traps. The trend is the current — swim with it." },
        { kind: "game", variant: "bull-or-bear", title: "Name the structure" },
        { kind: "quiz",
          question: "You see a series of higher highs and higher lows. What structure is this?",
          choices: ["Downtrend", "Uptrend", "Range", "Impossible to tell"],
          answer: 1,
          explain: "Higher highs + higher lows is the textbook definition of an uptrend. Buyers keep stepping in earlier and pushing further — they're in control." },
        { kind: "flashcards", title: "Structure",
          cards: [
            { front: "Higher high", back: "A peak above the previous peak — a sign of an uptrend." },
            { front: "Higher low", back: "A dip that stops above the previous dip — buyers defending higher." },
            { front: "Range", back: "Price stuck between a floor and a ceiling; no trend." },
            { front: "Trend reversal", back: "When the pattern breaks — e.g. an uptrend makes a lower low." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "p3-levels",
      title: "Support, resistance & breakouts",
      hook: "Prices have memory. The levels that stopped price before tend to matter again.",
      minutes: 14,
      xp: 85,
      sections: [
        { kind: "prose", text: "Support is a price floor where buyers keep stepping in — every time price falls to it, it bounces. Resistance is the ceiling where sellers keep appearing. These levels form because people remember them: buyers who missed the last bounce set orders there; sellers who got trapped want out at breakeven. Memory becomes a level." },
        { kind: "chart", variant: "support-resistance",
          caption: "Price tests the floor and ceiling again and again. Until it doesn't — and that's the interesting part." },
        { kind: "game", variant: "spot-the-level", title: "Find the support" },
        { kind: "analogy", title: "A ceiling becomes a floor",
          text: "Push through a ceiling and you're standing on it — old resistance often becomes new support. It's like breaking into the next floor of a building: the ceiling you smashed through is now the ground beneath you." },
        { kind: "keyIdea", title: "Breakouts and fakeouts",
          text: "When price finally punches through a level on strong volume, that's a breakout — often the start of a new leg. But thin, half-hearted breaks that snap back are fakeouts. Conviction (volume) is the tell." },
        { kind: "quiz",
          question: "A stock has bounced off $50 three times. What is $50 acting as?",
          choices: ["Resistance", "Support", "A moving average", "The spread"],
          answer: 1,
          explain: "$50 is a floor price buyers keep defending — that's support. If price finally breaks below it with force, support can flip into resistance." },
        { kind: "flashcards", title: "Levels",
          cards: [
            { front: "Support", back: "A price floor where buyers repeatedly step in." },
            { front: "Resistance", back: "A price ceiling where sellers repeatedly appear." },
            { front: "Breakout", back: "Price pushing decisively through a level — often on high volume." },
            { front: "Fakeout", back: "A break that fails and snaps back — traps the impatient." },
            { front: "Flip", back: "Broken resistance becoming new support (or vice versa)." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "p4-moving-averages",
      title: "Moving averages & the crossover",
      hook: "One line to smooth the noise, two lines to spot a shift in momentum.",
      minutes: 13,
      xp: 85,
      sections: [
        { kind: "prose", text: "A moving average is the simplest indicator there is: take the average closing price of the last N candles, and plot it. As new candles arrive, the window slides forward — hence 'moving.' It smooths the jitters so the underlying direction is easier to see. A short average (say 10) hugs the price; a long average (say 30) lags behind, showing the bigger trend." },
        { kind: "formula", label: "Simple moving average", expression: "SMA(n) = (P₁ + P₂ + … + Pₙ) ÷ n",
          legend: "The average of the last n closing prices. Bigger n = smoother and slower. Smaller n = twitchier and faster." },
        { kind: "chart", variant: "sma-cross",
          caption: "The fast (green) average reacts first. When it crosses above the slow (gold) average, momentum has turned up." },
        { kind: "keyIdea", title: "The crossover is a signal, not a promise",
          text: "When the fast average crosses above the slow one, recent momentum has overtaken the longer trend — often a buy signal. Crossing below is the reverse. But averages lag: they confirm moves after they start. Useful, never magic." },
        { kind: "quiz",
          question: "Why does a 30-period average lag behind a 10-period average?",
          choices: ["It uses older, slower data", "It averages more candles, so it reacts slower to new prices", "It only updates monthly", "It ignores the close"],
          answer: 1,
          explain: "A 30-period average blends 30 prices, so any single new price barely moves it — it's smooth but slow. The 10-period blends fewer, so it turns faster." },
        { kind: "desk", instruction: "Later, your assistant can hire an analyst that trades exactly this: 'buy when the 10-day crosses above the 30-day.' You'll build it in the Trading-with-AI stage.", symbol: "AAPL" },
        { kind: "flashcards", title: "Averages",
          cards: [
            { front: "Moving average (MA)", back: "The average close over the last N candles, replotted as the window slides." },
            { front: "SMA vs EMA", back: "Simple weights all candles equally; Exponential weights recent candles more." },
            { front: "Golden cross", back: "Fast MA crossing above slow MA — a bullish momentum signal." },
            { front: "Lag", back: "MAs confirm moves after they begin — the price you pay for smoothness." },
          ] },
      ],
    },
  ],
};
