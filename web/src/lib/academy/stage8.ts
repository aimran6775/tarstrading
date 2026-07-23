import type { Track } from "./types";

/*
  Stage 8 — Futures & Macro. Contracts on the future, the leverage that makes
  them potent, the shape of the forward curve (contango/carry), and the macro
  forces — rates and the dollar — that move everything at once. Plus hedging:
  using these tools to reduce risk, not just chase it.
*/

export const futuresStage: Track = {
  id: "s8-futures",
  title: "Futures & Macro",
  tagline: "Contracts on tomorrow, the leverage inside them, and the macro tide that moves all boats.",
  covers: "futures & the big picture",
  accent: "gold",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "fu1-what-are-futures",
      title: "A handshake on the future",
      hook: "A futures contract is a promise: buy or sell something, at a set price, on a set date.",
      minutes: 13,
      xp: 85,
      sections: [
        { kind: "analogy", title: "Locking in the price of coffee beans",
          text: "A café and a coffee farm agree today: 1,000 lbs of beans, $2/lb, delivered in three months — no matter the price then. Both sleep easy: the café knows its costs, the farm knows its revenue. That agreement is a futures contract, and it's been around for centuries." },
        { kind: "prose", text: "A futures contract obligates you to buy (or sell) an asset at an agreed price on an agreed future date. Unlike an option, it's not a right you can walk away from — it's a commitment. Futures exist on almost everything: oil, gold, wheat, stock indices, interest rates. Traders use them to speculate on direction, and businesses use them to lock in prices and remove uncertainty." },
        { kind: "keyIdea", title: "Futures are built-in leverage",
          text: "You don't pay the full value of a futures contract — just a margin deposit, often a few percent. That means small price moves translate into large gains or losses on your deposit. Futures are among the most leveraged instruments retail traders can touch, which makes position sizing (Stage 4) non-negotiable here." },
        { kind: "quiz",
          question: "How does a futures contract differ from an option?",
          choices: ["Futures are cheaper", "A future is an obligation to transact; an option is a right you can abandon", "Futures can't lose money", "There's no difference"],
          answer: 1,
          explain: "An option gives you the right to buy/sell — you can let it expire worthless, losing only the premium. A future is a binding commitment: both sides must transact at the agreed price and date." },
        { kind: "flashcards", title: "Futures basics",
          cards: [
            { front: "Futures contract", back: "A binding agreement to buy/sell an asset at a set price on a set date." },
            { front: "Margin (futures)", back: "The small deposit to control a full-size contract — the source of leverage." },
            { front: "Speculation vs hedging", back: "Betting on price vs locking in a price to remove risk." },
            { front: "Expiry / settlement", back: "When the contract comes due and is settled in cash or delivery." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "fu2-curve",
      title: "The forward curve: contango & carry",
      hook: "The future price isn't the same as today's. The gap has a name — and a cost.",
      minutes: 13,
      xp: 85,
      sections: [
        { kind: "prose", text: "The same asset has different prices for different delivery dates — that stack of prices is the forward curve. Usually, later dates cost more, because holding the physical thing (storing oil, insuring gold) costs money and that cost gets baked into the future price. When later is pricier than now, the market is in contango. When later is cheaper — often when there's a shortage today — it's in backwardation." },
        { kind: "chart", variant: "trend",
          caption: "Think of the curve as prices stepping up (contango) or down (backwardation) as you look further into the future." },
        { kind: "formula", label: "Cost of carry", expression: "future price ≈ spot price + storage + financing − yield",
          legend: "The future price reflects today's price plus the cost of carrying the asset until delivery (storage, interest) minus any income it throws off." },
        { kind: "keyIdea", title: "Roll cost quietly eats returns",
          text: "Futures expire, so to stay in a position you 'roll' — sell the expiring contract and buy a later one. In contango, the later contract is pricier, so each roll costs you a little. Hold a contango-ed future for months and roll cost can bleed away your gains even if the price barely moved. Curve shape is a hidden fee." },
        { kind: "quiz",
          question: "A market is in contango. What does that mean for someone rolling a long futures position?",
          choices: ["They earn extra each roll", "They pay a little each roll, since later contracts cost more", "Nothing changes", "The contract can't be rolled"],
          answer: 1,
          explain: "Contango means further-out contracts are more expensive. Rolling from a cheaper expiring contract into a pricier later one costs money each time — a slow drag on a long position." },
        { kind: "flashcards", title: "The curve",
          cards: [
            { front: "Forward curve", back: "The set of futures prices across different delivery dates." },
            { front: "Contango", back: "Later contracts cost more than today's price — the usual state." },
            { front: "Backwardation", back: "Later contracts cost less — often signals a shortage now." },
            { front: "Cost of carry", back: "Storage + financing costs baked into the future price." },
            { front: "Roll cost", back: "The drag from rolling into pricier later contracts in contango." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "fu3-macro",
      title: "Rates & the dollar: the tide",
      hook: "Two forces move nearly every market at once. Learn to feel the tide.",
      minutes: 14,
      xp: 90,
      sections: [
        { kind: "prose", text: "Individual stocks have their own stories, but two macro forces pull on everything together: interest rates and the US dollar. When the Fed raises interest rates, safe cash and bonds suddenly pay more, so riskier assets (growth stocks, crypto) look relatively worse and often fall. When rates drop, money flows back into risk. Rates are gravity for asset prices." },
        { kind: "keyIdea", title: "Higher rates, lower future value",
          text: "A stock is worth the value of its future profits, translated into today's dollars. Higher rates make future dollars worth less today (why wait years for money you could earn interest on now?). So rising rates especially punish companies whose profits are far in the future — high-growth tech — while barely touching steady cash generators." },
        { kind: "prose", text: "The dollar is the other tide. A strong dollar makes commodities (priced in dollars) more expensive for the rest of the world, often pushing their prices down. It pressures the earnings of big US companies that sell abroad. Currencies, commodities, and stocks are all connected — pull one lever and the others move." },
        { kind: "chart", variant: "sma-cross",
          caption: "Macro shifts show up as regime changes — the whole trend turning, not just one stock wobbling." },
        { kind: "quiz",
          question: "The Fed unexpectedly hikes interest rates. Which stocks tend to fall the most?",
          choices: ["Steady, profitable companies", "High-growth companies whose profits are years away", "It affects all stocks equally", "Only foreign stocks"],
          answer: 1,
          explain: "Higher rates shrink the present value of distant future profits. Growth companies — valued on earnings far in the future — get hit hardest, while steady cash generators are more insulated." },
        { kind: "flashcards", title: "Macro",
          cards: [
            { front: "Interest rates", back: "The price of money, set by the central bank — gravity for all asset prices." },
            { front: "The Fed", back: "The US central bank; its rate decisions move every market." },
            { front: "Present value", back: "What future money is worth today — falls as rates rise." },
            { front: "Strong dollar", back: "Pressures commodities and US exporters' earnings." },
            { front: "Risk-on / risk-off", back: "When money flows toward or away from risky assets, together." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "fu4-hedging",
      title: "Hedging: insurance, not a bet",
      hook: "The same tools that amplify risk can cancel it. That's the professional's real use.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "Everything so far framed futures and options as ways to bet. But their original purpose — and their most valuable one — is to REDUCE risk. A hedge is a position that offsets another. A farmer sells wheat futures to lock in a price and remove the risk of a bad market. An investor holding stocks buys index puts as insurance against a crash. You give up a little upside to cap the downside." },
        { kind: "analogy", title: "Home insurance for your portfolio",
          text: "You don't buy fire insurance because you expect a fire — you buy it so a fire won't ruin you. A hedge is the same: a small, steady cost that turns a catastrophic outcome into a survivable one. The point isn't to profit from the hedge; it's to still be standing afterward." },
        { kind: "keyIdea", title: "A hedge costs you in calm times, saves you in storms",
          text: "By design, a hedge loses a little when nothing goes wrong — that's the premium. Beginners see that drag and drop the hedge right before they need it. Professionals treat it as the cost of staying in the game through the one crash that would otherwise end them." },
        { kind: "quiz",
          question: "You hold a portfolio of stocks and buy put options on an index. What are you doing?",
          choices: ["Doubling your bet on stocks", "Hedging — buying insurance that pays off if the market falls", "Guaranteeing a profit", "Shorting your own stocks for tax reasons"],
          answer: 1,
          explain: "Index puts rise in value when the market falls, offsetting losses on your stocks. It's portfolio insurance: a small cost in calm times, a payout in a crash. That's hedging." },
        { kind: "flashcards", title: "Hedging",
          cards: [
            { front: "Hedge", back: "A position that offsets the risk of another — insurance, not a bet." },
            { front: "Portfolio insurance", back: "Using puts (or futures) to limit losses if the market drops." },
            { front: "Hedging cost", back: "The small, ongoing drag you pay to cap catastrophic downside." },
            { front: "Basis risk", back: "The risk a hedge doesn't perfectly offset the thing it's protecting." },
          ] },
      ],
    },
  ],
};
