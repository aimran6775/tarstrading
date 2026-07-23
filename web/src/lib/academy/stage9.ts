import type { Track } from "./types";

/*
  Stage 9 — Trading with AI. The stage that makes Tars Trading itself the
  lesson: what AI can and can't do for a trader, turning a plain-English idea
  into a transparent rule your assistant runs, the honest backtest, and the
  overfitting trap that sinks most "amazing" strategies. Learn by hiring a real
  analyst on the desk.
*/

export const aiStage: Track = {
  id: "s9-ai",
  title: "Trading with AI",
  tagline: "Turn a plain-English idea into a transparent, backtested analyst — and learn what AI can't do.",
  covers: "AI-assisted trading",
  accent: "agent",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "ai1-what-ai-can-do",
      title: "What AI can (and can't) do for a trader",
      hook: "AI won't tell you the future. It will do the disciplined, boring work you won't.",
      minutes: 12,
      xp: 90,
      sections: [
        { kind: "analogy", title: "A tireless junior analyst, not a fortune teller",
          text: "Think of AI as the world's most disciplined intern: it never gets bored, never revenge-trades, never 'feels' that this time is different. It watches a hundred charts at once and follows your rules to the letter. What it can't do is know what happens next — no one can." },
        { kind: "prose", text: "The honest promise of AI in trading is not prediction — it's discipline and scale. Where humans get emotional, tired, and inconsistent, a well-built system does exactly what it was told, every time, on every symbol, 24/7. That consistency is a real edge. But the moment someone sells you an AI that 'predicts the market' or 'guarantees returns,' close the tab. Markets are partly random; certainty is the tell of a scam." },
        { kind: "keyIdea", title: "AI amplifies your process — good or bad",
          text: "Automation makes a good process better and a bad process ruinous, faster. If you don't understand risk, sizing, and expectancy (the last five stages), an AI just helps you lose money more efficiently. The human sets the strategy and the risk limits; the machine executes." },
        { kind: "quiz",
          question: "Which is a realistic thing to expect from a trading AI?",
          choices: ["It predicts tomorrow's price", "It follows your rules consistently, without emotion, across many symbols", "It guarantees a profit", "It replaces the need to understand risk"],
          answer: 1,
          explain: "AI's real edge is disciplined, tireless, consistent execution of a strategy YOU designed — not prediction, guarantees, or a substitute for understanding risk. Anyone promising the others is selling something." },
        { kind: "flashcards", title: "AI reality check",
          cards: [
            { front: "What AI is good at", back: "Consistency, discipline, scale, no emotion, 24/7 execution." },
            { front: "What AI can't do", back: "Predict the future or guarantee returns. Markets are partly random." },
            { front: "The human's job", back: "Design the strategy, set the risk limits, decide what's acceptable." },
            { front: "Red flag", back: "Any 'AI' that promises prediction or guaranteed profit." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "ai2-plain-english-to-rules",
      title: "From plain English to a rule",
      hook: "Say what you want in words. Watch it become a rule the machine can actually run.",
      minutes: 13,
      xp: 95,
      sections: [
        { kind: "prose", text: "On the desk, you don't program anything. You tell your assistant what you want — “hire an analyst that buys NVDA when the 10-day average crosses above the 30-day, and sells when RSI(14) tops 70” — and it compiles that sentence into a precise, transparent rule the engine runs on every bar. No black box: you can read exactly what it built." },
        { kind: "widget", variant: "rule-builder" },
        { kind: "keyIdea", title: "If you can't state the rule, you don't have one",
          text: "The discipline of turning a vague hunch ('it looks bullish') into an exact rule ('SMA-10 crosses above SMA-30') is where most bad ideas die — and that's a feature. A rule you can write down is a rule you can test, measure, and improve. A hunch is just a feeling with a brokerage account." },
        { kind: "prose", text: "This is why everything you learned earlier matters here: your entry rule, your exit rule, your allocation, and your drawdown limit are all things you now understand. The assistant handles the syntax; you bring the judgment." },
        { kind: "quiz",
          question: "Why does forcing an idea into an explicit rule help?",
          choices: ["It makes the AI smarter", "A written rule can be backtested, measured, and improved; a hunch can't", "It guarantees the trade works", "It hides the logic from you"],
          answer: 1,
          explain: "Explicit rules are testable and measurable — you can check whether they actually worked. Vague intuition can't be evaluated, so it can't be improved. Clarity is the whole point." },
        { kind: "flashcards", title: "Rules",
          cards: [
            { front: "Entry rule", back: "The exact condition(s) that must be true to buy — ALL must fire." },
            { front: "Exit rule", back: "The condition(s) that trigger a sell — ANY can fire." },
            { front: "Universe", back: "The list of symbols an analyst is allowed to trade." },
            { front: "Transparent rule", back: "A strategy you can read and audit — no black box." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "ai3-honest-backtest",
      title: "The honest backtest & the overfitting trap",
      hook: "Any strategy can look brilliant on the past. The trick is not fooling yourself.",
      minutes: 15,
      xp: 100,
      sections: [
        { kind: "prose", text: "A backtest runs your rule over historical data to see how it would have done. It's the closest thing trading has to a lab. But it's also the easiest place to lie to yourself: with enough tweaking, you can make almost any strategy look like a money printer on data it has already seen. That's called overfitting — memorizing the past instead of finding a real edge." },
        { kind: "widget", variant: "overfit" },
        { kind: "keyIdea", title: "Out-of-sample is the only score that counts",
          text: "The cure is to split history: tune your strategy on the first chunk (in-sample), then test it — untouched — on a later chunk it has never seen (out-of-sample). If it holds up on the unseen data, you might have something. If it only shines on the data you tuned it on, you have a mirage. The desk's backtester reports both numbers, side by side, on purpose." },
        { kind: "prose", text: "This is why your assistant's backtest always shows in-sample AND out-of-sample results, and flags an 'overfit warning' when the two diverge. It would be easy to hide the ugly number and show you only the pretty one — most tools do. Refusing to is the difference between a teaching tool and a casino." },
        { kind: "quiz",
          question: "A strategy shows +90% in-sample but −5% out-of-sample. What does this mean?",
          choices: ["It's a great strategy", "It's overfit — it memorized the past and fails on new data", "The backtest is broken", "You should add more parameters"],
          answer: 1,
          explain: "Huge in-sample, negative out-of-sample is the signature of overfitting. It learned the noise of the old data, not a real pattern — so it collapses the moment it meets data it hasn't seen. Adding parameters makes it worse, not better." },
        { kind: "desk", instruction: "Go to your Assistant and say: “Hire an analyst that buys AAPL when the 10-day crosses above the 30-day, sells when RSI(14) tops 70. Then backtest it.” Read both numbers it returns — the out-of-sample one is the résumé." },
        { kind: "flashcards", title: "Backtesting",
          cards: [
            { front: "Backtest", back: "Running a rule over historical data to estimate how it would have performed." },
            { front: "Overfitting", back: "Tuning a strategy so tightly to the past that it fails on new data." },
            { front: "In-sample", back: "The historical data you tuned the strategy on." },
            { front: "Out-of-sample", back: "Fresh data the strategy never saw — the only honest test." },
            { front: "Drawdown limit", back: "A max loss threshold that auto-halts an analyst — your safety switch." },
          ] },
      ],
    },
  ],
};
