import type { Track } from "./types";

/*
  Stage 7 — Options. The topic that scares beginners, made visual: calls and
  puts through the payoff diagram, what an option is worth (intrinsic + time +
  volatility), the Greeks without the mysticism, and spreads that cap risk.
  Drag the payoff widget and options stop being abstract.
*/

export const optionsStage: Track = {
  id: "s7-options",
  title: "Options",
  tagline: "Calls, puts, and the Greeks — leverage and insurance, made visual with payoff diagrams.",
  covers: "options",
  accent: "agent",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "op1-calls-puts",
      title: "Calls & puts: the right, not the obligation",
      hook: "An option is a coupon: the right to buy or sell at a set price. Drag one and watch it pay.",
      minutes: 14,
      xp: 95,
      sections: [
        { kind: "analogy", title: "A call is a deposit on a house",
          text: "You pay $5,000 to lock in the right to buy a house at $400k within a year. If prices soar to $500k, your coupon is gold — you buy at 400 and you're up. If they fall, you just walk away, out only the deposit. That deposit is the premium; that locked price is the strike." },
        { kind: "prose", text: "A call option gives you the right — not the obligation — to BUY a stock at a fixed price (the strike) before a deadline. A put option gives you the right to SELL at the strike. You pay a small premium for that right. If the option expires worthless, all you lose is the premium. If it works, the payoff can dwarf what you paid. That asymmetry — small fixed risk, large potential reward — is the whole appeal." },
        { kind: "widget", variant: "payoff" },
        { kind: "keyIdea", title: "Buyers risk the premium; sellers take the other side",
          text: "When you BUY an option, your loss is capped at the premium — that's the safety of it. When you SELL (write) an option, you collect the premium up front but take on the risk: a sold call has unlimited loss if the stock soars. Toggle the payoff above to sell-side and watch the shape flip." },
        { kind: "quiz",
          question: "You buy a call with a $100 strike for a $5 premium. The stock ends at $103 at expiry. What's your result?",
          choices: ["+$3 profit", "−$2 (the option is worth $3, you paid $5)", "+$103", "−$5, total loss"],
          answer: 1,
          explain: "The call is worth its intrinsic value: $103 − $100 = $3. You paid $5 for it, so you're down $2. It needed to reach the break-even of $105 (strike + premium) just to cover the cost." },
        { kind: "flashcards", title: "Options basics",
          cards: [
            { front: "Call option", back: "The right to BUY at the strike price before expiry." },
            { front: "Put option", back: "The right to SELL at the strike price before expiry." },
            { front: "Strike", back: "The fixed price the option lets you buy or sell at." },
            { front: "Premium", back: "The price you pay for the option — the buyer's max loss." },
            { front: "Break-even", back: "Strike ± premium — where the trade starts making money." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "op2-value",
      title: "What an option is worth",
      hook: "Two ingredients set every option's price: what it's worth now, and what might still happen.",
      minutes: 13,
      xp: 90,
      sections: [
        { kind: "prose", text: "An option's premium is made of two parts. Intrinsic value is what it's worth if you exercised right now — a $100 call with the stock at $108 has $8 of intrinsic value. Time value is everything else: the extra you pay for the chance the stock moves further before expiry. As expiry approaches, time value melts away — an effect called time decay." },
        { kind: "formula", label: "Option premium", expression: "premium = intrinsic value + time value",
          legend: "Intrinsic = how far in-the-money it is (never below zero). Time value = the price of hope — it decays to zero at expiry." },
        { kind: "prose", text: "The wild card is implied volatility (IV) — the market's guess at how much the stock will swing. High IV means fatter time value: bigger expected moves make options more valuable, so they cost more. When a big event (like earnings) passes and uncertainty collapses, IV drops and option prices can fall hard even if you guessed direction right — the dreaded 'IV crush'." },
        { kind: "widget", variant: "payoff" },
        { kind: "keyIdea", title: "You can be right and still lose",
          text: "Buy an option before earnings when IV is sky-high, guess direction correctly, and still lose money if the move is smaller than the inflated premium priced in. Options aren't just a bet on direction — they're a bet on direction AND magnitude AND timing. Three ways to be wrong." },
        { kind: "quiz",
          question: "A $50 call trades for $7 while the stock is at $54. How much is time value?",
          choices: ["$7", "$4", "$3", "$0"],
          answer: 2,
          explain: "Intrinsic value = $54 − $50 = $4. Premium is $7, so time value = $7 − $4 = $3 — the extra you're paying for the chance it moves further before expiry." },
        { kind: "flashcards", title: "Option value",
          cards: [
            { front: "Intrinsic value", back: "What the option is worth if exercised now (never below 0)." },
            { front: "Time value", back: "The extra premium for the chance of further movement — decays to expiry." },
            { front: "Implied volatility (IV)", back: "The market's expectation of how much the stock will move." },
            { front: "IV crush", back: "A sharp drop in IV (e.g. after earnings) that deflates option prices." },
            { front: "In-the-money", back: "An option with intrinsic value — a call below the stock price." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "op3-greeks",
      title: "The Greeks, without the mysticism",
      hook: "Four Greek letters, four simple questions. That's all the Greeks really are.",
      minutes: 14,
      xp: 95,
      sections: [
        { kind: "prose", text: "The Greeks sound intimidating but each just answers one plain question about how your option's price will move. You don't need the calculus — you need the intuition." },
        { kind: "keyIdea", title: "Delta — how much does it move with the stock?",
          text: "Delta is how many dollars the option gains for each $1 the stock rises. A delta of 0.5 means the option moves 50 cents per dollar. It's also a rough probability the option finishes in-the-money. Deep in-the-money options have delta near 1 — they track the stock almost dollar-for-dollar." },
        { kind: "keyIdea", title: "Gamma — how fast does delta itself change?",
          text: "Gamma is the acceleration: how quickly delta shifts as the stock moves. High gamma (near the strike, near expiry) means your exposure changes fast — thrilling on the way up, brutal on the way down." },
        { kind: "keyIdea", title: "Theta — how much does time cost you?",
          text: "Theta is the daily bleed from time decay. If you own an option, theta is working against you every single day — a theta of −0.05 means you lose 5 cents a day just from the clock, all else equal. Option sellers collect theta; buyers pay it." },
        { kind: "keyIdea", title: "Vega — how much does volatility matter?",
          text: "Vega is how much the option's price changes when implied volatility moves 1%. Buy options when IV is low (cheap hope) and you have positive vega working for you; buy when IV is sky-high and vega can crush you when it normalizes." },
        { kind: "quiz",
          question: "You own a call option and the stock goes nowhere for a week. Which Greek most likely cost you money?",
          choices: ["Delta", "Gamma", "Theta", "Vega"],
          answer: 2,
          explain: "Theta — time decay. Even with the stock flat, every passing day bleeds time value out of the option you own. Option buyers race the clock; theta is the clock." },
        { kind: "flashcards", title: "The Greeks",
          cards: [
            { front: "Delta", back: "How much the option moves per $1 in the stock (~probability of finishing ITM)." },
            { front: "Gamma", back: "How fast delta changes — the acceleration of your exposure." },
            { front: "Theta", back: "Daily time decay — the cost of holding an option each day." },
            { front: "Vega", back: "Sensitivity to implied volatility — how much a 1% IV change moves the price." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "op4-spreads",
      title: "Spreads: cap the risk, cap the reward",
      hook: "Combine two options and you can shape risk like clay — pay less, define your worst case.",
      minutes: 13,
      xp: 90,
      sections: [
        { kind: "prose", text: "Buying a naked option can be expensive, and selling one can be dangerous. A spread solves both by combining legs: you buy one option and sell another against it. The sold leg pays for part of the bought leg (cheaper entry) and caps your risk — but it also caps your reward. You trade unlimited upside for a defined, affordable, sleep-at-night structure." },
        { kind: "widget", variant: "payoff" },
        { kind: "keyIdea", title: "The classic: a call debit spread",
          text: "Buy a call at one strike, sell a call at a higher strike. You pay less than the naked call (the sold call funds it), your max loss is that net cost, and your max gain is the gap between strikes minus the cost. Bounded both ways — you know your worst and best case before you enter." },
        { kind: "prose", text: "Spreads are how professionals actually trade options most of the time. Naked long options bleed theta; naked short options carry tail risk. Spreads let you express a view — direction, or even 'nothing happens' — with a risk you've defined in advance. That's the same discipline you learned in the risk stage, applied to options." },
        { kind: "quiz",
          question: "Why sell a higher-strike call against a call you bought (a debit spread)?",
          choices: ["To make the trade riskier", "To lower the cost and cap the maximum loss, giving up some upside", "To guarantee a profit", "To avoid paying any premium"],
          answer: 1,
          explain: "The sold call brings in premium that offsets the cost of the one you bought — cheaper entry and a capped, known max loss. The trade-off is that your upside is capped at the higher strike." },
        { kind: "desk", instruction: "Options aren't on the simulator yet (equities and crypto first). For now, practice the mindset: on any trade, define your max loss BEFORE you enter — the exact discipline a spread enforces." },
        { kind: "flashcards", title: "Spreads",
          cards: [
            { front: "Spread", back: "A position combining a bought and a sold option to shape risk/reward." },
            { front: "Debit spread", back: "You pay a net premium; max loss = cost, max gain = strike gap − cost." },
            { front: "Credit spread", back: "You collect a net premium; you profit if the stock behaves." },
            { front: "Defined risk", back: "A structure whose max loss is known before you enter." },
          ] },
      ],
    },
  ],
};
