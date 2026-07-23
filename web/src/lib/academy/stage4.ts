import type { Track } from "./types";

/*
  Stage 4 — Risk & Position Sizing. The stage that keeps you in the game.
  Risk-per-trade, sizing from the stop, R-multiples, and the brutal math of
  drawdown — all driven by the calculators, because this is the one place the
  numbers MUST become muscle memory.
*/

export const riskStage: Track = {
  id: "s4-risk",
  title: "Risk & Position Sizing",
  tagline: "The one skill every blown-up account skipped. Risk small, size from your stop, survive the streaks.",
  covers: "the survival math",
  accent: "loss",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "r1-risk-per-trade",
      title: "Risk a fixed slice, every time",
      hook: "Great traders aren't right more often. They just lose less when they're wrong.",
      minutes: 13,
      xp: 90,
      sections: [
        { kind: "analogy", title: "A casino doesn't bet the whole vault on one hand",
          text: "The house wins because it risks a tiny fraction on each bet and plays thousands of them. One bad hand can't hurt it. You want to be the house, not the gambler shoving all-in and praying." },
        { kind: "prose", text: "The single decision that separates traders who last from those who don't: risk a small, fixed fraction of your account on every trade — commonly 1%. Not 1% some days and 20% when you feel sure. Fixed. Feelings are the enemy; a rule you set in advance is the cure." },
        { kind: "formula", label: "Risk per trade", expression: "risk $ = account × risk %",
          legend: "On a $100,000 account at 1%, you risk $1,000 per trade — the most you'll lose if the stop is hit. That number never changes with your confidence." },
        { kind: "calc", tool: "position-size", title: "Set your risk, get your size" },
        { kind: "keyIdea", title: "Confidence doesn't size trades — math does",
          text: "The moment you size up because you're 'sure,' you've handed your account to your emotions. The surest-looking trades blow up just as often. Fixed risk protects you from the one you can't see coming." },
        { kind: "quiz",
          question: "You have $50,000 and risk 1% per trade. How much can you lose on one trade?",
          choices: ["$5,000", "$500", "$50", "Depends on the stock price"],
          answer: 1,
          explain: "1% of $50,000 is $500. That's your fixed risk — the share count adjusts around it, but the dollars you can lose stay put." },
        { kind: "flashcards", title: "Risk basics",
          cards: [
            { front: "Risk per trade", back: "A small fixed % of the account (often 1%) — the max loss if the stop hits." },
            { front: "Why fixed?", back: "It removes emotion and guarantees no single trade can wreck you." },
            { front: "Risk of ruin", back: "The odds of blowing up. Small fixed risk drives it toward zero." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "r2-r-multiples",
      title: "Think in R, not dollars",
      hook: "Stop counting dollars and start counting Rs. It's how pros keep score.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "Here's a mindset shift that clears the fog: measure every trade in R, where 1R is the amount you risked. Risk $500 and make $1,500? That's +3R. Lose the full stop? That's −1R. Now every trade speaks the same language, regardless of the stock's price or your account size. A string of results becomes +2R, −1R, +3R, −1R — instantly readable." },
        { kind: "formula", label: "R-multiple", expression: "R = profit or loss ÷ initial risk",
          legend: "1R = your risk amount. A trade that makes twice what you risked is +2R; a full stop-out is −1R. Judge trades in R, and account size stops mattering." },
        { kind: "calc", tool: "risk-reward", title: "See the R before you enter" },
        { kind: "keyIdea", title: "Only take trades with room to run",
          text: "If you're risking 1R to make less than 1R, the math is fighting you. Aim for setups offering 2R or more. Then even a 40% win rate is deeply profitable — because your winners dwarf your losers." },
        { kind: "game", variant: "size-it", title: "Translate to shares" },
        { kind: "quiz",
          question: "You risked $200 and the trade made $600. What's the result in R?",
          choices: ["+2R", "+3R", "+6R", "−1R"],
          answer: 1,
          explain: "$600 ÷ $200 = 3. The trade returned three times what you risked: +3R. This is why a few big winners can carry a whole month." },
        { kind: "flashcards", title: "R-multiples",
          cards: [
            { front: "1R", back: "The amount you risked on a trade — your unit of measure." },
            { front: "+2R", back: "A trade that made twice what you risked." },
            { front: "−1R", back: "A full stop-out — the loss you planned for." },
            { front: "Why R?", back: "It makes every trade comparable, regardless of price or account size." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "r3-drawdown-math",
      title: "The cruel math of drawdown",
      hook: "Losing hurts twice: once when it happens, and again when you have to climb back.",
      minutes: 14,
      xp: 95,
      sections: [
        { kind: "prose", text: "Here's the trap nobody warns beginners about: gains and losses aren't symmetric. Lose 50% and you don't need a 50% gain to recover — you need 100%, because you're now working from a smaller base. Lose 10% and you need 11% back. Lose 50% and you need to double. This is why protecting capital beats chasing returns: the deeper the hole, the steeper the climb out." },
        { kind: "formula", label: "Recovery required", expression: "gain to recover = loss ÷ (1 − loss)",
          legend: "Down 20%? You need 25% to get back. Down 50%? You need 100%. The math punishes big losses exponentially — which is the entire case for small, fixed risk." },
        { kind: "keyIdea", title: "Small risk survives long streaks",
          text: "At 1% risk, ten losses in a row leaves you down about 10% — annoying, survivable, recoverable. At 10% risk, ten losses nearly wipes you out. Losing streaks are not rare; they're guaranteed. Sizing decides whether they're a bruise or a funeral." },
        { kind: "calc", tool: "compounding", title: "Small edges, compounded" },
        { kind: "prose", text: "Flip the lens with the compounding tool above: the same discipline that limits your losses lets a tiny, repeatable edge snowball. Survival first, then let compounding do the heavy lifting. You don't need to be brilliant — you need to not blow up long enough for the math to work." },
        { kind: "quiz",
          question: "Your account falls 25%. What gain do you now need just to break even?",
          choices: ["25%", "About 33%", "About 50%", "20%"],
          answer: 1,
          explain: "25% ÷ (1 − 0.25) = 33%. You're rebuilding from a smaller base, so it takes more than the loss to recover. This asymmetry is why capital preservation wins." },
        { kind: "desk", instruction: "Open Performance on the desk after a few trades — the equity curve and drawdown are your real report card. Watch the dips, not just the peaks.", symbol: "SPY" },
        { kind: "flashcards", title: "Drawdown",
          cards: [
            { front: "Drawdown", back: "The drop from an equity peak to a trough — how much you're down from your best." },
            { front: "Recovery asymmetry", back: "Bigger losses need disproportionately bigger gains to recover." },
            { front: "Risk of ruin", back: "Probability of losing so much you can't continue — crushed by small fixed risk." },
            { front: "Capital preservation", back: "Protecting the downside first; returns come second." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "r4-portfolio-heat",
      title: "Portfolio heat: your real risk",
      hook: "You sized each trade at 1%. You have eight of them. So what are you really risking?",
      minutes: 13,
      xp: 95,
      sections: [
        { kind: "prose", text: "Everything so far has been about one trade: risk 1%, set a stop, size it right. But you rarely hold just one position. The question that actually blows up accounts isn't 'how big is this trade?' — it's 'how much am I risking across everything at once?' The sum of all your open risk has a name on professional desks: heat." },
        { kind: "keyIdea", title: "Add up every stop, not just this one",
          text: "If you hold six positions each risking 1%, your portfolio heat is 6% — the amount you'd lose if every stop hit on the same bad day. And bad days are exactly when everything moves together. Sizing one trade perfectly means nothing if you're stacked into ten of them." },
        { kind: "widget", variant: "heat" },
        { kind: "prose", text: "A common professional guardrail is to cap total heat around 6% — pick your own number, but pick one, and honor it. When you're at the cap, a new idea doesn't get added; it has to compete. Either it replaces a weaker position or you size everything down to make room. That constraint is a feature: it forces you to hold only your best ideas." },
        { kind: "keyIdea", title: "Managing a position after entry",
          text: "Risk isn't fixed once you're in. As a trade works, moving your stop up to breakeven turns a live risk into a free roll — you can no longer lose on it, so its heat drops to zero. Scaling out (selling part into strength) banks profit and cuts exposure. Good position management is a slow, deliberate reduction of risk as uncertainty resolves." },
        { kind: "quiz",
          question: "You hold five positions, each risking 1.5% of the account. What's your portfolio heat?",
          choices: ["1.5%", "5%", "7.5%", "It depends on which wins"],
          answer: 2,
          explain: "5 × 1.5% = 7.5%. That's what you lose if every stop triggers together — and correlated positions tend to. Above a ~6% cap, one rough day does real damage. The fix is fewer positions or smaller size." },
        { kind: "desk", instruction: "On the desk, open two or three positions and add up what you'd lose if each hit its stop. That total — your heat — is the number that actually matters. Try moving a winner's stop to breakeven and watch its risk vanish.", symbol: "NVDA" },
        { kind: "flashcards", title: "Portfolio risk",
          cards: [
            { front: "Portfolio heat", back: "Total open risk — the sum of every position's risk if all stops hit at once." },
            { front: "Heat cap", back: "A pre-set ceiling on total open risk (e.g. ~6%) that forces you to hold only your best ideas." },
            { front: "Stop to breakeven", back: "Moving a winner's stop to your entry — the trade can no longer lose; its heat drops to zero." },
            { front: "Scaling out", back: "Selling part of a position into strength to bank profit and cut exposure." },
            { front: "Correlation risk", back: "Positions that move together aren't diversified — in a shock they act as one big bet." },
          ] },
      ],
    },
  ],
};
