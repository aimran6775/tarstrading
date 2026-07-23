import type { Track } from "./types";

/*
  Trading Psychology — the missing pillar. You can know every chart pattern and
  still blow up, because the hard part isn't the market, it's the person
  trading it. Three lessons: the four emotions that cost money, tilt and
  revenge trading (with a simulator that makes the damage a number), and the
  discipline rituals that keep the good habits on rails. Sits after "Building
  an Edge" — an edge you can't execute calmly isn't an edge.
*/

export const psychologyStage: Track = {
  id: "s6-mind",
  title: "Trading Psychology",
  tagline: "The enemy is you. Fear, greed, and tilt cost more than any bad chart read.",
  covers: "the inner game",
  accent: "agent",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "mind1-the-enemy-is-you",
      title: "The enemy is you",
      hook: "Markets don't take your money. Your fear, greed, and hope hand it over.",
      minutes: 12,
      xp: 90,
      sections: [
        { kind: "prose", text: "Here's the uncomfortable truth almost no beginner believes until it costs them: the hardest part of trading isn't reading the chart. It's sitting still while money moves in front of you. The same brain that kept your ancestors alive — flee danger, chase reward, cling to hope — is catastrophically wrong at trading. Every classic mistake traces back to an emotion overriding a plan." },
        { kind: "analogy", title: "The market is a mirror, not an opponent",
          text: "The market doesn't know you exist. It isn't hunting your stop or celebrating your loss. Every painful move you take personally is just other people, acting on their own fear and greed. When you feel the market is 'out to get you,' you're looking at your own reflection." },
        { kind: "keyIdea", title: "Four feelings, four ways to lose",
          text: "Fear makes you cut winners early and skip good trades. Greed makes you oversize and hold too long. FOMO makes you chase moves you missed, buying the top. Hope makes you hold losers past the stop, praying for a bounce. Name the feeling as it arrives — naming it is the first inch of control." },
        { kind: "prose", text: "Notice what these have in common: none of them are about analysis. You can be completely right about a stock and still lose money because greed made you too big or hope stopped you from cutting the loss. This is why two traders with the identical strategy get opposite results — the strategy was never the variable. The behavior was." },
        { kind: "quiz",
          question: "You skipped a trade that fit your plan perfectly because the last two lost. What emotion just cost you?",
          choices: ["Greed", "Fear", "FOMO", "None — that was discipline"],
          answer: 1,
          explain: "Fear. A plan is a plan whether the last trade won or lost — each setup is independent. Letting recent losses scare you out of valid trades is how fear quietly shrinks a positive edge to nothing." },
        { kind: "flashcards", title: "The four emotions",
          cards: [
            { front: "Fear (in trading)", back: "Cutting winners early and skipping valid setups after a loss." },
            { front: "Greed", back: "Oversizing and holding winners past the plan, giving back profit." },
            { front: "FOMO", back: "Fear of missing out — chasing a move you missed, often buying the top." },
            { front: "Hope", back: "Holding a loser past its stop, praying for a bounce instead of obeying the plan." },
            { front: "The real opponent", back: "Not the market — your own emotional reaction to it." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "mind2-tilt",
      title: "Tilt and the revenge trade",
      hook: "One loss stings. Trying to win it back immediately is how accounts actually die.",
      minutes: 13,
      xp: 95,
      sections: [
        { kind: "prose", text: "\"Tilt\" is a poker word for the state where emotion takes the wheel — usually after a loss that felt unfair. On tilt, a trader stops following the plan and starts trying to get even with the market. The most dangerous form is the revenge trade: doubling your size to win back what you just lost in one shot. It feels like taking control. It's the opposite." },
        { kind: "prose", text: "The math is brutal, and it's worth seeing rather than being told. Below, the same losing streak hits two traders. One risks a flat 1% every trade. The other doubles down after each loss to 'win it back.' Drag the streak and watch the gap." },
        { kind: "widget", variant: "tilt" },
        { kind: "keyIdea", title: "Doubling down doesn't fix a loss — it detonates it",
          text: "Increasing size after a loss is called martingale, and it feels logical: one win erases everything. But losing streaks are normal and clustered, and each double makes the next loss twice as expensive. You're not managing risk, you're betting the account on a coin flip landing before you run out of chips. It always lands wrong eventually." },
        { kind: "prose", text: "The disciplined trader's secret isn't that they don't feel the sting — they feel it exactly as much. They've just decided in advance that size never changes because of emotion. After a rough day, the professional move is boring: reduce size or stop for the day. You cannot revenge-trade a loss if your rule says the next trade is the same size as every other." },
        { kind: "quiz",
          question: "You take three losses in a row. Which response protects the account?",
          choices: ["Double your next size to recover faster", "Keep size identical, or reduce it / stop for the day", "Switch to a riskier strategy to catch up", "Add to a losing position to lower your average"],
          answer: 1,
          explain: "Same size or smaller. A losing streak is a signal to protect capital, not to press. Doubling, switching to riskier plays, or averaging down are all tilt wearing a disguise — each one raises risk exactly when you're least clear-headed." },
        { kind: "desk", instruction: "Next time you close a losing trade on the desk, notice the pull to 'get it back' immediately. Name it — that's tilt — and place your next trade at the same size you always do, or walk away.", symbol: "SPY" },
        { kind: "flashcards", title: "Tilt",
          cards: [
            { front: "Tilt", back: "An emotional state, usually after a loss, where you abandon the plan to get even." },
            { front: "Revenge trade", back: "Oversizing to win back a loss in one shot — the fastest way to a blown account." },
            { front: "Martingale", back: "Doubling size after each loss. Feels logical, mathematically ruinous." },
            { front: "The disciplined response to a losing streak", back: "Same size or smaller — never bigger. Reduce risk when clarity is lowest." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "mind3-discipline",
      title: "Discipline is a system, not a feeling",
      hook: "You won't feel disciplined in the moment. So you build rules that don't need you to.",
      minutes: 13,
      xp: 95,
      sections: [
        { kind: "prose", text: "The trap is thinking discipline is willpower — that good traders just want it more. They don't. Willpower fails exactly when markets get exciting, which is exactly when it matters. Professionals don't rely on feeling disciplined; they build systems that make the disciplined choice the default and the reckless one require extra effort. Rules on paper beat resolve in the moment, every time." },
        { kind: "keyIdea", title: "Decide when it's cheap, not when it's expensive",
          text: "Every decision is easy before the trade is on and hard once money is moving. So make every decision in advance: your entry, your stop, your size, your target — written down while you're calm. In the heat of the trade you're not deciding, you're executing a decision your calm self already made. That's the whole game." },
        { kind: "prose", text: "The simplest, most powerful tool for this is a pre-trade checklist. It sounds almost too basic to matter — pilots and surgeons use them precisely because expertise doesn't prevent lapses under pressure. Run the list before every entry. If you can't honestly tick every box, that's not a trade, it's an urge." },
        { kind: "widget", variant: "checklist" },
        { kind: "prose", text: "One more rule that saves accounts: a maximum daily loss. Decide, in advance, the dollar or percent drop that ends your day — no exceptions, no 'one more to get it back.' It converts a bad day into a small, survivable one. The traders who last aren't the ones who never have bad days; they're the ones whose bad days are capped." },
        { kind: "game", variant: "size-it", title: "Size it right — under pressure" },
        { kind: "quiz",
          question: "Why do professionals write their stop and size down before entering?",
          choices: ["To impress a mentor", "Because decisions made calmly beat decisions made while money is moving", "It's required by the broker", "To make trades slower"],
          answer: 1,
          explain: "Because your calm self makes far better decisions than your in-the-trade self. Pre-committing to a stop and size means the hard choice is already made — under pressure you only have to execute it, not invent it." },
        { kind: "desk", instruction: "Before your next trade on the desk, actually run the five-point checklist above out loud. If even one box won't tick honestly, skip the trade. Notice how often 'no trade' is the right answer.", symbol: "AAPL" },
        { kind: "flashcards", title: "Discipline",
          cards: [
            { front: "Discipline (real definition)", back: "A system that makes the right choice the default — not willpower in the moment." },
            { front: "Pre-trade checklist", back: "A fixed list run before every entry: thesis, stop, size, reward, and 'am I on tilt?'" },
            { front: "Maximum daily loss", back: "A pre-set loss that ends your trading day, no exceptions — caps bad days." },
            { front: "Pre-commitment", back: "Deciding entry, stop, size and target while calm, so you only execute under pressure." },
          ] },
      ],
    },
  ],
};
