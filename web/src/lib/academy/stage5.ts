import type { Track } from "./types";

/*
  Stage 5 — Building an Edge. What actually makes a strategy work: expectancy,
  the win-rate trap, and the process/journaling discipline that turns random
  trades into a measurable edge. The bridge from "I place trades" to "I run a
  system."
*/

export const edgeStage: Track = {
  id: "s5-edge",
  title: "Building an Edge",
  tagline: "Expectancy, the win-rate trap, and the process that turns luck into a system.",
  covers: "what makes it work",
  accent: "gain",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "e1-expectancy",
      title: "Expectancy: the only number that matters",
      hook: "Forget 'was that a good trade?' Ask 'is this a good system?' — expectancy answers it.",
      minutes: 13,
      xp: 90,
      sections: [
        { kind: "prose", text: "Any single trade is noise — a coin can land heads five times in a row. What matters is your edge over many trades, and there's one number that captures it: expectancy. It tells you the average profit (in R) you can expect per trade if you keep doing what you're doing. Positive expectancy over hundreds of trades is, quite literally, the whole job." },
        { kind: "formula", label: "Expectancy", expression: "E = (win% × avg win) − (loss% × avg loss)",
          legend: "In R units. A positive number means each trade, on average, makes money. A negative one means you're paying the market to trade — no position size saves that." },
        { kind: "calc", tool: "expectancy", title: "Find your edge" },
        { kind: "keyIdea", title: "One good trade means nothing; 100 mean everything",
          text: "Judge yourself on the system, not the last trade. A great trader can lose on a perfectly executed trade and win on a reckless one — outcome and process are different things. Expectancy over a big sample is the only honest scoreboard." },
        { kind: "quiz",
          question: "Which system is more profitable over 100 trades?",
          choices: ["Wins 70% of the time, average win 0.5R, average loss 1R", "Wins 40% of the time, average win 2.5R, average loss 1R", "They're identical", "Can't tell without the account size"],
          answer: 1,
          explain: "System A: 0.7×0.5 − 0.3×1 = +0.05R. System B: 0.4×2.5 − 0.6×1 = +0.40R. The 40% winner makes eight times more — because payoff beats accuracy." },
        { kind: "flashcards", title: "Expectancy",
          cards: [
            { front: "Expectancy", back: "Average profit per trade (in R): win% × avg win − loss% × avg loss." },
            { front: "Edge", back: "A repeatable reason your expectancy is positive." },
            { front: "Sample size", back: "The number of trades needed before your stats mean anything (think 100+)." },
            { front: "Positive expectancy", back: "The mathematical definition of a profitable system." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "e2-win-rate-trap",
      title: "The win-rate trap",
      hook: "A 90% win rate can quietly bankrupt you. Here's the trap that fools everyone.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "New traders obsess over win rate — being right feels good. But win rate alone tells you nothing about whether you make money. A strategy that wins 90% of the time but lets the 10% of losers run huge will bleed out. A strategy that wins 40% but cuts losses fast and lets winners run can mint money. Payoff — how big your wins are versus your losses — matters more than how often you're right." },
        { kind: "calc", tool: "expectancy", title: "Crank the win rate — watch it lie" },
        { kind: "prose", text: "Try it: set win rate to 80% but make the average loss 3R and the average win 0.5R. Green most of the time, red on the bottom line. Now flip it — 40% wins, 3R average win, 1R loss — and watch the edge appear. High accuracy with terrible payoff is the most seductive way to lose." },
        { kind: "analogy", title: "The gambler who wins every hand but one",
          text: "Picture someone who wins $10 on nine hands, then loses $500 on the tenth. Nine green, one red — a 90% win rate — and they're down $410. The single fat loss ate every small win. Cutting losers is worth more than being right." },
        { kind: "keyIdea", title: "Cut losers fast, let winners run",
          text: "It's the oldest rule in trading because it's the hardest to follow. Taking small planned losses feels like failure; letting a winner run feels like greed. Do both anyway — your expectancy depends on it far more than your accuracy does." },
        { kind: "quiz",
          question: "A system wins 80% of trades but has negative expectancy. What's the most likely cause?",
          choices: ["The win rate is too high", "The average loss is much bigger than the average win", "It doesn't trade enough", "Commissions"],
          answer: 1,
          explain: "Winning often but losing big on the rare loss destroys expectancy. If losers are several times your winners, an 80% win rate still loses money. Payoff rules." },
        { kind: "flashcards", title: "Win rate vs payoff",
          cards: [
            { front: "Win rate", back: "The % of trades that are profitable — necessary but not sufficient." },
            { front: "Payoff ratio", back: "Average win ÷ average loss — often more important than win rate." },
            { front: "The win-rate trap", back: "Chasing high accuracy while ignoring the size of losses." },
            { front: "Cut losers, run winners", back: "The behavior that keeps expectancy positive." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "e3-process",
      title: "Process over outcome — and the journal",
      hook: "You can't control whether a trade wins. You can control whether it was a good decision.",
      minutes: 14,
      xp: 95,
      sections: [
        { kind: "prose", text: "The hardest idea in trading: a losing trade can be a great decision, and a winning trade can be a terrible one. Markets are probabilistic — good process loses sometimes, bad process wins sometimes. If you judge yourself only by the result, you'll learn the wrong lessons: punished for good habits, rewarded for reckless ones. Judge the decision, not the dice." },
        { kind: "analogy", title: "A surgeon and a coin",
          text: "A great surgeon can lose a patient to bad luck; a reckless one can get lucky. You'd still want the great surgeon. Trading is the same — evaluate the quality of the decision separately from how the coin landed." },
        { kind: "keyIdea", title: "The journal is where luck and skill separate",
          text: "Write down, before you enter: your thesis, where you're wrong (the stop), your target, and your size. After, note what actually happened and whether you followed your own plan. Over dozens of entries, patterns surface — the setups that work, the mistakes you repeat. The journal is the microscope that turns noise into an edge." },
        { kind: "prose", text: "This is exactly what the desk's journal does automatically: every closed trade is logged with its entry, exit, and P&L, so your track record builds itself. Your job is to review it honestly — the trader who studies their own tape improves; the one who only remembers the wins does not." },
        { kind: "quiz",
          question: "You followed your plan perfectly and the trade still lost. How should you grade it?",
          choices: ["A bad trade — it lost money", "A good trade — the process was sound; the outcome was variance", "Impossible to say", "It depends on how much you lost"],
          answer: 1,
          explain: "Good process, bad luck. If you sized right, honored your stop, and had a real thesis, it was a good trade with a bad outcome. Repeat the process and expectancy takes care of the rest." },
        { kind: "desk", instruction: "Make a trade with a clear thesis, then close it and open Performance. Read the journal entry like a scientist reading data — not a fan reading a scoreboard.", symbol: "NVDA" },
        { kind: "flashcards", title: "Process",
          cards: [
            { front: "Process vs outcome", back: "Judge the quality of the decision, not just whether it won." },
            { front: "Variance", back: "The randomness that makes good process lose sometimes." },
            { front: "Trading journal", back: "A log of thesis, stop, target, size and result — where you find your edge." },
            { front: "Thesis", back: "Your specific reason for the trade and what would prove it wrong." },
          ] },
      ],
    },
  ],
};
