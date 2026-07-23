import type { Track } from "./types";

/*
  Stage 10 — Run It Like a Fund. The finale: stop trading one stock and start
  managing a book. Portfolio thinking, correlation, gross/net exposure, and the
  process that binds every earlier stage into an operating system. This is where
  a trader becomes a manager.
*/

export const fundStage: Track = {
  id: "s10-fund",
  title: "Run It Like a Fund",
  tagline: "Portfolio thinking, correlation, exposure, and the process that turns trades into a system.",
  covers: "the whole book",
  accent: "gold",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "h1-portfolio",
      title: "You manage a book, not a stock",
      hook: "Ten great trades in the same direction aren't a portfolio — they're one big bet.",
      minutes: 13,
      xp: 90,
      sections: [
        { kind: "prose", text: "The moment you hold more than one position, you're a portfolio manager. And the first thing a manager learns is that positions interact. Ten tech stocks feel like ten bets, but if they all rise and fall together, you really own one giant tech bet dressed up as diversification. What matters isn't how many things you hold — it's how independently they move." },
        { kind: "analogy", title: "Don't hire ten of the same person",
          text: "Building a team, you wouldn't hire ten identical people — you'd get people who are strong where the others are weak. A portfolio is the same: you want holdings that don't all stumble at once, so a bad day for one is a normal day for another." },
        { kind: "keyIdea", title: "Correlation is the hidden risk",
          text: "Correlation measures how much two holdings move together: +1 means lockstep, 0 means independent, −1 means opposite. A portfolio of highly correlated positions has far more risk than it looks — one shock hits everything at once. True diversification means low correlation, not just many tickers." },
        { kind: "widget", variant: "correlation" },
        { kind: "quiz",
          question: "You own five different oil stocks. How diversified are you, really?",
          choices: ["Very — five different companies", "Barely — they're highly correlated, so it's essentially one big oil bet", "Perfectly hedged", "Impossible to say"],
          answer: 1,
          explain: "Five oil stocks move together on the oil price — high correlation. That's close to one concentrated bet, not five independent ones. Diversification is about low correlation, not just the number of names." },
        { kind: "flashcards", title: "Portfolio thinking",
          cards: [
            { front: "Portfolio", back: "Your whole set of positions, managed as one book." },
            { front: "Correlation", back: "How much two holdings move together: +1 lockstep, 0 independent, −1 opposite." },
            { front: "Concentration risk", back: "Too much exposure to one theme, even across many tickers." },
            { front: "True diversification", back: "Holdings with low correlation — they don't all fall at once." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "h2-exposure",
      title: "Exposure: how much is really on the table",
      hook: "Two numbers tell you your real risk in a glance: gross and net.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "As a book grows, you need a dashboard. The two gauges that matter most are gross exposure and net exposure. Gross is the total size of all your bets added up, longs and shorts together — how much is at work. Net is your longs minus your shorts — which direction you're leaning overall. A book can be huge (high gross) but market-neutral (near-zero net) if longs and shorts balance." },
        { kind: "formula", label: "Exposure", expression: "gross = |longs| + |shorts|   ·   net = longs − shorts",
          legend: "Gross measures how much risk is deployed; net measures your directional tilt. Pros watch both — a low net can hide a dangerously high gross." },
        { kind: "keyIdea", title: "Net tells you your market bet; gross tells you your leverage",
          text: "If your net exposure is +80%, you're basically betting the market goes up. If it's near 0%, you're betting on your stock-picking, not the market's direction. Meanwhile, gross above 100% means you're leveraged — using more than your cash. Keep both in ranges you chose in advance." },
        { kind: "widget", variant: "heat" },
        { kind: "quiz",
          question: "Your book is 60% long and 55% short. What's your net exposure?",
          choices: ["115%", "5% net long", "5% net short", "0%"],
          answer: 1,
          explain: "Net = longs − shorts = 60% − 55% = +5% net long. Your gross is 115% (some leverage), but your directional bet is tiny — you're mostly betting on your picks, not the market." },
        { kind: "flashcards", title: "Exposure",
          cards: [
            { front: "Gross exposure", back: "Total size of all positions (longs + shorts) — how much risk is deployed." },
            { front: "Net exposure", back: "Longs minus shorts — your overall directional bet." },
            { front: "Market-neutral", back: "Net near zero — betting on stock selection, not market direction." },
            { front: "Leverage", back: "Gross above 100% — using more than your cash." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "h4-scorecard",
      title: "Reading your scorecard: risk-adjusted returns",
      hook: "A 40% return means nothing until you know how much risk you took to get it.",
      minutes: 13,
      xp: 100,
      sections: [
        { kind: "prose", text: "Amateurs brag about returns. Professionals ask a harder question: how much risk did you take to earn them? Two traders both made 30% this year — but one rode a stomach-churning rollercoaster and the other barely felt a bump. The second is the far better trader, and there are numbers that prove it. Learning to read them is how you judge a strategy honestly, including your own." },
        { kind: "keyIdea", title: "Volatility: how bumpy the ride was",
          text: "Volatility (standard deviation of returns) measures how much your results swing around their average. High volatility means big ups and downs — more stress, and a bigger risk that a bad stretch forces you out at the worst time. Two strategies with the same average return but different volatility are not equally good: the smoother one is easier to hold, and holding is where returns actually come from." },
        { kind: "formula", label: "Sharpe ratio", expression: "Sharpe = (return − risk-free rate) ÷ volatility",
          legend: "Return earned per unit of risk taken. Higher is better. Above ~1 is solid, above ~2 is excellent. It's the single best one-number answer to 'was this skill or was this just leverage?'" },
        { kind: "prose", text: "The Sharpe ratio divides your excess return by your volatility — reward per unit of risk. It's the great equalizer: it strips away leverage and luck and asks whether you were actually compensated for the risk you took. A 15% return with a Sharpe of 2 beats a 40% return with a Sharpe of 0.5, because the second one only got there by betting big — and betting big eventually meets the drawdown that ends it." },
        { kind: "keyIdea", title: "Maximum drawdown: the number that decides if you survive",
          text: "Max drawdown is the deepest peak-to-trough fall your account suffered. It matters more than any return figure, because it's the number that makes people quit — nobody rationally sticks with a strategy through a 60% drawdown, even if it recovers. When you judge a track record, look at the worst drop first. If you couldn't stomach it live, the returns above it are fiction." },
        { kind: "desk", instruction: "Open Performance on the desk. Your equity curve and its drawdown are your real scorecard — read the depth of the dips, not just the height of the peaks. That's the number a professional looks at first.", symbol: "SPY" },
        { kind: "quiz",
          question: "Strategy A returned 40% (Sharpe 0.5). Strategy B returned 18% (Sharpe 1.8). Which is the better strategy?",
          choices: ["A — it made more money", "B — it earned far more return per unit of risk", "They're equal", "Impossible to compare"],
          answer: 1,
          explain: "B. A's big return came from taking big risk (low Sharpe) — the kind that eventually meets a drawdown that ends the game. B earned more per unit of risk, which is the return you can actually compound and survive. Risk-adjusted beats raw every time." },
        { kind: "flashcards", title: "The scorecard",
          cards: [
            { front: "Volatility", back: "Standard deviation of returns — how much your results swing. Lower is easier to hold." },
            { front: "Sharpe ratio", back: "Excess return ÷ volatility — reward per unit of risk. Above ~1 is solid." },
            { front: "Maximum drawdown", back: "The deepest peak-to-trough fall — the number that decides whether you quit." },
            { front: "Risk-adjusted return", back: "Return measured against the risk taken to earn it — the honest scoreboard." },
            { front: "Beta", back: "How much a position moves with the market — 1 tracks it, 0 ignores it." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "h3-process",
      title: "The process: your operating system",
      hook: "Everything you've learned only works if it becomes a routine you actually follow.",
      minutes: 15,
      xp: 110,
      sections: [
        { kind: "prose", text: "You've now got the whole toolkit: read price, place orders, size from your stop, measure expectancy, use AI, manage a portfolio. But knowledge isn't an edge — execution is. The difference between traders who make it and those who don't is rarely what they know; it's whether they follow their own rules when it's hard. The answer is a process: a repeatable routine that takes the decision out of the heat of the moment." },
        { kind: "keyIdea", title: "The loop: plan → size → execute → journal → review",
          text: "Before a trade: a thesis and where you're wrong. At entry: size from the stop, risk a fixed slice. In the trade: honor the stop, no negotiating. After: journal it. Weekly: review the journal for patterns. Run this loop a few hundred times and you're not gambling anymore — you're operating a system with a measurable edge." },
        { kind: "calc", tool: "expectancy", title: "Your system's edge, one more time" },
        { kind: "prose", text: "This is exactly what Tars is built to support: the desk sizes with a buying-power meter, journals every closed trade automatically, and shows you the equity curve and drawdown. Your assistant can even run rule-based analysts so part of your process is automated and consistent by design. The tools handle the discipline; you bring the judgment and the review." },
        { kind: "game", variant: "size-it", title: "Prove the process is muscle memory" },
        { kind: "keyIdea", title: "Survive, compound, repeat",
          text: "The whole academy reduces to three moves: don't blow up (risk small), keep a positive edge (expectancy), and let time compound it (patience). It's not glamorous and it's not a secret. It's just what actually works — and now you know how to do it. Go run your book like you mean it." },
        { kind: "desk", instruction: "You've finished the academy. Now the real work: make a trade with a written thesis, size it from a stop, journal the result, and review it honestly. Repeat. That loop is the whole job.", symbol: "AAPL" },
        { kind: "flashcards", title: "The system",
          cards: [
            { front: "Process", back: "A repeatable routine that removes emotion from decisions." },
            { front: "The loop", back: "Plan → size → execute → journal → review." },
            { front: "Execution edge", back: "Consistently following your rules — worth more than any secret." },
            { front: "The three moves", back: "Survive (risk small), keep an edge (expectancy), compound (patience)." },
          ] },
      ],
    },
  ],
};
