import type { Track } from "./types";

/*
  Stage 13 — The Margin Desk.

  Every mechanic in this stage is LIVE on the platform: SPAN portfolio margin
  computes the requirement on the futures book, financing posts to the journal
  daily off the real fed funds rate, the two-hour cure window is a genuine
  state machine, and a split adjusts a real position. The learner can verify
  each lesson against their own account while reading it — that is the whole
  design of this stage, and why every lesson ends at a desk instruction.

  The thread running through all five: leverage is not free, and the thing
  that ends most leveraged accounts is not a wrong opinion about direction.
  It is a requirement they didn't know they had.
*/

export const marginStage: Track = {
  id: "s13-margin",
  title: "The Margin Desk",
  tagline: "What it costs to borrow, what the exchange demands to let you hold, why hedging makes your requirement fall, and the two hours between a breach and a liquidation.",
  covers: "Reg-T, SPAN, financing & margin calls",
  accent: "loss",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "m1-what-margin-is",
      title: "Margin is a deposit, not a loan",
      hook: "Two things share one word. Confusing them is how people get liquidated by a position that was right.",
      minutes: 12,
      xp: 90,
      sections: [
        { kind: "analogy", title: "The rental deposit and the mortgage",
          text: "When you rent a flat you leave a deposit. It is your money, it sits with the landlord, and you get it back — it is a promise you'll be good for any damage. When you buy a flat with a mortgage, the bank hands you money that isn't yours and charges rent on it until you give it back. Both are called 'borrowing' in casual speech. They are opposites. Futures margin is the deposit. Buying stock on margin is the mortgage." },
        { kind: "prose", text: "Buy $10,000 of stock with $5,000 of your own money and the broker lends you the other $5,000. That is a real loan: cash moved, you owe it, and it accrues interest every day until you close the position or pay it down. Your account shows a DEBIT BALANCE — negative cash — and on this platform that balance costs the fed funds rate plus 1.50%, posted daily to your journal." },
        { kind: "keyIdea", title: "Futures move no principal at all",
          text: "Buy one E-mini S&P contract and nothing is purchased. The contract's notional might be $370,000, but no $370,000 changes hands and you borrow nothing. What happens is that roughly $23,000 of your equity becomes SPOKEN FOR — held as initial margin, a good-faith deposit that you're able to cover the day's moves. Your cash doesn't fall. Your available buying power does. That is why a futures position accrues no interest here while a margin loan does." },
        { kind: "formula", label: "Reg-T initial margin on stock", expression: "you must hold ≥ 50% of the position's value as equity",
          legend: "A $10,000 stock position requires $5,000 of your own equity, so $10,000 of equity supports up to $20,000 of stock — 2:1. That is the legal maximum for a US retail cash-equity account, and it is where the platform sets the gate." },
        { kind: "prose", text: "The word for the money that's actually yours is EQUITY: cash plus what your positions are worth right now, marked live, including gains and losses you haven't taken yet. Every requirement on the desk is measured against equity, never against what you deposited. This matters more than it sounds. Your requirement is computed from a number that moves every second the market is open, which means a position that falls in value shrinks the very equity that was supporting it. That feedback loop is the mechanism behind almost every margin call in history." },
        { kind: "quiz", question: "You hold 1 E-mini S&P futures contract worth $370,000 notional, and $100,000 of equity. How much cash did you spend to open it?",
          choices: ["$370,000", "$185,000 — half, on margin", "Nothing — about $23,000 of equity became held as initial margin", "$23,000 was debited from cash"],
          answer: 2,
          explain: "Futures move no principal. Opening the position debits nothing; it reserves initial margin against your equity. Your cash is untouched and your buying power falls by the requirement. This is exactly why futures accrue no financing interest while a stock bought on margin does." },
        { kind: "desk", instruction: "Open your Margin Desk and read the Initial requirement and Buying power figures. With no positions, buying power should be about twice your equity — that is Reg-T's 2:1, stated in your own numbers." },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m2-financing",
      title: "What leverage costs while you sleep",
      hook: "A leveraged position doesn't have to be right. It has to be right faster than its financing.",
      minutes: 11,
      xp: 90,
      sections: [
        { kind: "analogy", title: "The escalator running the wrong way",
          text: "Standing still on a down escalator, you lose ground. To stay level you have to walk; to climb you have to walk faster than it descends. A borrowed position works the same way — the financing runs against you every single day, including the days the market is closed, so a position that goes exactly nowhere for a month has still cost you something." },
        { kind: "prose", text: "This desk charges the effective federal funds rate — the real one, read daily from the Federal Reserve's own published series — plus 1.50% on any debit balance. It pays the fed funds rate MINUS 0.50% on idle cash. Both accrue on an actual/360 basis: the annual rate divided by 360, applied to each day's balance. One entry posts to your journal every day with the arithmetic written out." },
        { kind: "formula", label: "One day of margin interest", expression: "daily cost = debit balance × (fed funds + 1.50%) ÷ 360",
          legend: "Borrow $50,000 at 4.33% fed funds and the rate is 5.83%. A day costs 50,000 × 0.0583 ÷ 360 ≈ $8.10. Hold it a year and it's about $2,915 — money the position must earn back before your first dollar of profit." },
        { kind: "keyIdea", title: "The rate you earn is the tell",
          text: "Most large brokers pay their clients close to nothing on idle cash while earning the full market rate on it themselves — the gap is one of the industry's quietest and largest revenue lines. This platform pays fed funds minus 0.50% because the point here is to show you the mechanism rather than to profit from your not noticing it. When you eventually choose a real broker, ask what they pay on cash. The answer tells you who the customer is." },
        { kind: "prose", text: "Financing changes which trades are worth doing, not just how much they earn. A strategy that clears 3% a year is genuinely profitable unlevered and genuinely loss-making at 2:1 leverage, because the borrowed half is paying 5.83% to earn 3%. Leverage doesn't multiply a good idea; it multiplies the gap between the idea's return and its cost of carry. If that gap is negative, leverage multiplies a loss." },
        { kind: "quiz", question: "Your strategy returns 4% a year. You run it at 2:1 with margin costing 5.83%. Roughly what do you earn?",
          choices: ["8% — leverage doubled it", "About 2.2% — the borrowed half earned 4% but paid 5.83%", "4% — leverage cancels out", "Nothing — leverage never helps"],
          answer: 1,
          explain: "Your half earns 4%. The borrowed half earns 4% and pays 5.83%, losing 1.83% on that portion. Net ≈ 4% − 1.83% ≈ 2.2% on your own capital — LESS than doing it unlevered, with double the risk. Leverage only helps when the return exceeds the cost of carry." },
        { kind: "desk", instruction: "Open your Journal and filter to Events. Find today's $CASH financing row: it states the fed funds rate used, the rate applied, and the dollars. If you hold no debit balance, it's interest you EARNED on idle cash." },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m3-span",
      title: "Why a hedge makes your requirement fall",
      hook: "Long one index future and short another can require less margin than either position alone. That isn't a discount — it's the arithmetic of risk.",
      minutes: 13,
      xp: 100,
      sections: [
        { kind: "analogy", title: "Two bets that can't both lose",
          text: "Bet $100 that it rains tomorrow and $100 that it doesn't. You have $200 at stake and zero risk — whatever happens, one ticket pays. A bookmaker who demanded $200 of collateral would be pricing a danger that cannot occur. Exchanges figured this out decades ago, which is why the requirement on a hedged futures book is a fraction of the requirement on its pieces." },
        { kind: "prose", text: "The real system is called SPAN, and it's what CME clearing uses to margin a portfolio rather than a pile of unrelated contracts. It recognises three kinds of offset, and this desk models all three. First, CALENDAR SPREADS: long September crude and short October crude is a bet on the SHAPE of the oil curve, not on the price of oil — if oil collapses, both legs move together and the loss largely cancels. Second, MICRO VERSUS FULL: ten Micro E-mini S&P contracts against one short full-size E-mini is the same index in both directions, and nets to almost nothing. Third, INTER-COMMODITY credits: long S&P and short Nasdaq are two different products, but they move together closely enough that the exchange publishes a credit — on this desk, 70% of the smaller leg for equity indices, 55% for metals, 50% for energy, 40% for grains." },
        { kind: "formula", label: "An equity-index spread's requirement", expression: "IM ≈ leg₁ + leg₂ − 0.70 × min(leg₁, leg₂)",
          legend: "One MES ($2,300) long against one MNQ ($2,600) short: 2,300 + 2,600 − 0.70 × 2,300 = $3,290, versus $4,900 margining them separately. The $1,610 difference is the credit — and it appears in your Margin Desk by name." },
        { kind: "keyIdea", title: "Credits are capped, because correlation is a fair-weather friend",
          text: "Offset legs still keep a 5% residual charge, and a whole book never margins below 25% of its naive sum. This is deliberate and it is the most important line in the model. Correlations that hold for years break exactly when markets panic — in October 1987, in 2008, in March 2020, relationships that had been reliable for a decade decoupled within hours. A margin system that trusted correlation completely would be perfectly calibrated right up to the moment it mattered, and catastrophically wrong after. The floor is humility, expressed as arithmetic." },
        { kind: "prose", text: "There's a consequence worth sitting with: on this desk, ADDING a position can REDUCE your requirement. If you're long two S&P contracts and near your limit, shorting a Nasdaq contract may free margin rather than consume it, because it makes the book less directional. That is genuinely how a professional futures desk manages capacity — and it's the opposite of the retail intuition that more positions always means more risk." },
        { kind: "quiz", question: "You hold long 1 MES. You add short 1 MES in a different expiry month. What happens to your requirement?",
          choices: ["It doubles — two positions, two margins", "It falls close to the floor — a calendar spread's risk is the curve's shape, not the index's level", "It stays the same", "The order is rejected as a wash trade"],
          answer: 1,
          explain: "Opposing legs in the same product net in margin dollars, leaving a small residual — and the 25% floor catches it there. You still hold real risk (the spread between the two months can move) but nothing like the risk of an outright." },
        { kind: "desk", instruction: "On the Margin Desk, use the what-if box: enter MESU6 with quantity 1, note the requirement it adds. Then enter MNQU6 with quantity −1 and watch the credit appear. The preview runs the same function the order gate does — what it says is what the desk will charge." },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m4-margin-call",
      title: "The two hours between a breach and a liquidation",
      hook: "The market does not liquidate you. Your maintenance requirement does — and it gives you a window first.",
      minutes: 12,
      xp: 100,
      sections: [
        { kind: "analogy", title: "The fire alarm and the sprinklers",
          text: "An alarm gives you time to walk out. Sprinklers protect the building whether or not you left. A margin call is the alarm; forced liquidation is the sprinklers. The window between them exists so you can choose WHICH positions to close — because if you wait, the desk chooses, and its priority is protecting itself, not preserving the trade you believed in most." },
        { kind: "prose", text: "Two different numbers govern a position. INITIAL margin is what you need to OPEN it — 50% for stock, the spec-sheet dollar amount for futures. MAINTENANCE margin is what you need to KEEP it: 25% for stock, and a slightly lower dollar figure for each futures contract. The gap between them is deliberate. It means a position can move against you somewhat without immediately triggering anything — but it also means a book opened right at the initial limit is already close to the maintenance line." },
        { kind: "formula", label: "The breach", expression: "equity < maintenance requirement  →  margin call",
          legend: "Hold $40,000 of stock with $12,000 of equity and you need 25% of $40,000 = $10,000. You're fine. The stock falls 10%: the position is $36,000 and your equity is $8,000 against a $9,000 requirement. You are in breach — not because you spent anything, but because the asset moved." },
        { kind: "keyIdea", title: "The loop that makes this fast",
          text: "Falling prices reduce your equity and your requirement at the same time, but not at the same rate. Equity falls by the FULL loss; the requirement falls by only 25% of it. So every dollar the position drops costs you a dollar of equity and relieves just twenty-five cents of requirement. The gap closes three times faster than most people expect, which is why margin calls feel sudden even to people who were watching." },
        { kind: "prose", text: "When this desk detects a breach it stamps the account, notifies you, and starts a two-hour clock. During that window you can cure it yourself — close anything, and closing reduces the requirement faster than it reduces equity, which is the same asymmetry working in your favour for once. If the clock runs out, the desk liquidates: futures first, because they free the most margin per contract closed, then the largest equity position. It does not consult your thesis, and neither does a real one." },
        { kind: "quiz", question: "You're in a margin call with 40 minutes left. What's the most effective thing you can do?",
          choices: ["Wait — the position might recover", "Close positions yourself, starting with whatever consumes the most margin", "Buy more to average down", "Nothing — the outcome is the same either way"],
          answer: 1,
          explain: "Closing reduces your requirement faster than it reduces equity, so it cures the breach — and doing it yourself means YOU choose what survives. Waiting hands that choice to the desk, whose priority is its own protection. Averaging down INCREASES the requirement and deepens the breach immediately." },
        { kind: "desk", instruction: "Set a margin alert before you ever need one: on the Alerts panel, use the $MARGIN symbol with a level of 0.8 to be told when your book commits 80% of equity. The warning you want is the one that arrives before the breach." },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m5-defined-risk",
      title: "Selling options without unlimited risk",
      hook: "A naked short call can lose more than your account holds. One extra contract turns it into a position with a known worst case.",
      minutes: 12,
      xp: 100,
      sections: [
        { kind: "analogy", title: "Insurance with and without a reinsurer",
          text: "Sell someone fire insurance and you collect a premium; if the house burns, you owe the whole house. Insurers survive this by buying their own insurance above a certain level — they keep the small claims and hand the catastrophic tail to someone else. A spread is that reinsurance. You keep the premium on the near strike and buy protection at a further one, so your worst day is a number you chose in advance rather than a number the market chooses for you." },
        { kind: "prose", text: "Sell a call and you've promised to deliver shares at the strike no matter what they cost. If the stock triples, your loss triples with it — there is no ceiling, which is why this desk refuses naked calls entirely. Two structures make short options safe enough to learn on. A COVERED call is backed by 100 shares you already own per contract. A CASH-SECURED put sets aside the full purchase price in cash. Both were already here. The third is the vertical spread, and it's the one that just arrived." },
        { kind: "formula", label: "A vertical call spread's maximum loss", expression: "max loss = (short strike − long strike) × 100 × contracts",
          legend: "Sell the $100 call and buy the $105 call in the same expiry: the most you can lose is (105 − 100) × 100 = $500 per contract, minus the premium you took in. If the stock goes to $400, your short leg's loss is capped by your long leg's gain. The desk requires that $500 in cash and lets the trade through." },
        { kind: "keyIdea", title: "The wing has to be real",
          text: "A protective leg only counts if it caps the loss: for calls it must be at a HIGHER strike, for puts a LOWER one, and it must be the same underlying AND the same expiry. A long call expiring next week does not protect a short call expiring next month — the moment the protection expires, you are naked, and that gap is where accounts die. The desk checks all three conditions before it will treat your short leg as defined-risk." },
        { kind: "prose", text: "Why does this matter for learning? Because selling options is where most of the pedagogically interesting mechanics live — time decay, implied volatility, assignment risk — and the only responsible way to let a beginner touch it is with the tail bolted down. A spread lets you be wrong about direction, wrong about timing, and wrong about volatility all at once, and still know exactly what the mistake costs before you make it." },
        { kind: "quiz", question: "You sell a $100 call and buy a $95 call, same expiry. Is your risk defined?",
          choices: ["Yes — any second leg caps the loss", "No — for a CALL spread the protective leg must be at a HIGHER strike", "Yes, but only if the stock stays below $95", "No — call spreads are never defined-risk"],
          answer: 1,
          explain: "A $95 call is BELOW your short $100 strike, so it does nothing to cap a rally: above $100 your short leg keeps losing without limit while the long leg is already fully in the money. The wing must sit beyond the strike you sold — higher for calls, lower for puts." },
        { kind: "desk", instruction: "Open any liquid stock's option chain. Price a vertical: note the premium you'd collect on the near strike, the cost of the protective wing, and the width between them. Width × 100, minus net premium, is the worst day this trade can have." },
      ],
    },
  ],
};
