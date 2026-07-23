import type { Track } from "./types";

/*
  Stage 3 — Orders & Execution. The mechanics of actually getting in and out:
  the three order types, the hidden cost of the spread, and stops as the
  seatbelt that ties directly back into position sizing.
*/

export const ordersTrack: Track = {
  id: "s3-orders",
  title: "Orders & Execution",
  tagline: "Market, limit, stop — the three orders you'll live by, and the real cost of a trade.",
  covers: "getting in & out",
  accent: "gold",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "o1-three-orders",
      title: "The three orders you'll live by",
      hook: "Every trade you ever place is one of three verbs. Learn them cold.",
      minutes: 12,
      xp: 75,
      sections: [
        { kind: "prose", text: "There are only three orders you really need. A market order says 'fill me now, at whatever the price is' — speed over price. A limit order says 'only fill me at my price or better' — price over speed, and it might never fill. A stop order sits dormant until price hits a trigger, then fires like a market order — usually to cut a loss or protect a profit." },
        { kind: "analogy", title: "Buying concert tickets",
          text: "Market order: 'I'll pay whatever, just get me in.' Limit order: 'I'll only pay up to $80 — if they never drop to that, I don't go.' Stop order: 'If prices ever fall to $40, snap them up automatically.' Same three choices, every market." },
        { kind: "game", variant: "order-match", title: "Match the order to the job" },
        { kind: "keyIdea", title: "Market fills fast; limit fills right",
          text: "Use market orders when getting in matters more than a few cents (liquid names, fast moves). Use limits when the price matters more than the timing, or the stock is thin and a market order could get an ugly fill." },
        { kind: "quiz",
          question: "You want to buy only if the price drops to $95, and you're fine waiting. Which order?",
          choices: ["Market order", "Limit order at $95", "Stop order at $95", "There's no way to do this"],
          answer: 1,
          explain: "A buy limit at $95 waits patiently and only fills at $95 or lower. If price never dips there, you simply don't get filled — which is the point." },
        { kind: "flashcards", title: "The three orders",
          cards: [
            { front: "Market order", back: "Fills immediately at the best available price. Speed over price." },
            { front: "Limit order", back: "Fills only at your price or better. Price over speed — may never fill." },
            { front: "Stop order", back: "Dormant until a trigger price, then fires like a market order." },
            { front: "Stop-limit", back: "A stop that turns into a limit (not a market) once triggered — more control, more risk of no fill." },
          ] },
        { kind: "desk", instruction: "On the desk, switch the ticket between Market, Limit, and Stop. Watch how the fields change — a limit asks for your price, a stop asks for your trigger.", symbol: "NVDA" },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "o2-slippage",
      title: "Slippage & the spread tax",
      hook: "The price you see and the price you get aren't always the same. Know the difference.",
      minutes: 12,
      xp: 80,
      sections: [
        { kind: "prose", text: "You already met the spread — the gap between the best bid and best ask. Every market order pays it: you buy at the ask and later sell at the bid, so you start every trade slightly behind. On top of that sits slippage: when the market moves in the split-second between your click and your fill, or when your order is bigger than what's available at the best price, you get a worse fill than expected." },
        { kind: "chart", variant: "spread",
          caption: "You buy at the ask (25.02), you sell at the bid (24.98). That gap is money — small on liquid names, brutal on thin ones." },
        { kind: "formula", label: "Round-trip cost", expression: "cost ≈ spread + slippage (+ fees)",
          legend: "On a liquid stock this is pennies and ignorable. On a thin one, or a huge order, it can quietly dwarf your edge." },
        { kind: "analogy", title: "Wet paint on the price tag",
          text: "The quote is the price tag, but the ink is still wet — by the time your hand reaches it, it may have smudged a little. Fast, liquid markets dry instantly; slow, thin ones smear." },
        { kind: "keyIdea", title: "Liquidity is your friend",
          text: "Trade liquid names (tight spreads, high volume) and slippage barely registers. In thin names, use limit orders to name your price and refuse to overpay. The simulator models this honestly — 5 bps of slippage against you, every fill." },
        { kind: "quiz",
          question: "Best bid $20.00, best ask $20.20. You market-buy then instantly market-sell. Roughly what happens?",
          choices: ["Break even", "Down ~$0.20/share — the spread", "Up ~$0.20/share", "The order is rejected"],
          answer: 1,
          explain: "You bought at 20.20 and sold at 20.00 — the 20-cent spread is the round-trip toll, before any slippage or fees. Wide spreads are expensive to cross." },
        { kind: "flashcards", title: "Costs",
          cards: [
            { front: "Slippage", back: "Getting a worse fill than expected because price moved or the book was thin." },
            { front: "Spread tax", back: "The unavoidable cost of buying at the ask and selling at the bid." },
            { front: "Liquidity", back: "How easily you can trade size without moving the price." },
            { front: "bps (basis point)", back: "One hundredth of a percent. 5 bps = 0.05%." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "o3-stops",
      title: "Stops: your seatbelt",
      hook: "The stop isn't just an order — it's the number that decides your entire position size.",
      minutes: 14,
      xp: 90,
      sections: [
        { kind: "prose", text: "A stop-loss is a pre-decided price where you admit the trade was wrong and get out — no negotiating with yourself in the moment. It's a seatbelt: uncomfortable to think about, invaluable in a crash. And here's the connection that ties this whole stage together: your stop determines your size. The distance from entry to stop is your risk-per-share, and that's what the position-size math runs on." },
        { kind: "keyIdea", title: "Stop first, size second",
          text: "Amateurs pick a share count, then maybe add a stop. Pros pick where they're wrong (the stop), decide how much they'll lose (risk), and let those two numbers hand them the share count. The order is everything." },
        { kind: "calc", tool: "position-size", title: "Watch the stop set your size" },
        { kind: "prose", text: "Drag the stop closer to your entry above and watch the share count climb — a tighter stop means less risk per share, so you can hold more shares for the same total risk. Drag it further and shares shrink. The stop is the dial that controls everything." },
        { kind: "game", variant: "size-it", title: "Size from the stop" },
        { kind: "keyIdea", title: "Never move a stop away from price",
          text: "The deadliest habit in trading is widening a stop to avoid taking the loss — 'it'll come back.' That turns a small planned loss into an account-ending one. You can move a stop to lock in profit; never move it to hope." },
        { kind: "desk", instruction: "Place a small position on the desk, then set a stop-loss below it. Feel what it's like to define your exit before you need it.", symbol: "AAPL" },
        { kind: "flashcards", title: "Stops",
          cards: [
            { front: "Stop-loss", back: "A pre-set exit price for a losing trade — decided before you enter." },
            { front: "Risk-per-share", back: "The distance from entry to stop — the engine of position sizing." },
            { front: "Trailing stop", back: "A stop that follows price up to lock in gains, never moving down." },
            { front: "Stop first, size second", back: "Decide where you're wrong, then let the math set your share count." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "o4-advanced-orders",
      title: "Beyond the big three",
      hook: "Market, limit, and stop cover most of trading. A few more tools cover the rest.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "You know the three orders that do 90% of the work. The remaining tools are refinements — ways to combine the basics so the exchange enforces your plan while you're away from the screen. You won't need all of them often, but knowing they exist means you're never stuck watching a position because you couldn't automate the exit." },
        { kind: "keyIdea", title: "Stop-limit: a stop that won't chase a crash",
          text: "A plain stop becomes a market order when triggered — in a fast crash it can fill far below your level (slippage). A stop-limit triggers, then places a limit order, so it won't fill below a price you set. The trade-off: in a violent drop it might not fill at all, leaving you still holding. Protection with a catch." },
        { kind: "keyIdea", title: "Trailing stop: lock in gains automatically",
          text: "A trailing stop follows price up by a fixed distance (say 5%) and never moves down. As the trade works, your exit ratchets higher, locking in more profit; if price reverses by your trail amount, you're out. It's how you 'let winners run' without having to babysit the chart — the exit manages itself." },
        { kind: "keyIdea", title: "Bracket & OCO: plan the whole trade at once",
          text: "A bracket order sets your entry, your profit target, and your stop-loss together — the moment you're filled, both exits are working. OCO ('one-cancels-other') links the target and stop so that when one fills, the other automatically cancels. This is the disciplined trader's default: the entire trade, exits included, decided and placed before emotion gets a vote." },
        { kind: "keyIdea", title: "Time-in-force: how long an order lives",
          text: "Every order carries a lifespan. 'Day' expires at the close; 'GTC' (good-till-canceled) waits for days until it fills or you kill it; 'IOC' (immediate-or-cancel) fills what it can right now and cancels the rest. It's a small setting that decides whether your resting limit order is still there tomorrow — worth knowing before you wonder where it went." },
        { kind: "quiz",
          question: "You're up nicely and want to protect gains while giving the trend room to run, without watching the screen. Which order?",
          choices: ["A market order", "A trailing stop", "A day limit order", "An IOC order"],
          answer: 1,
          explain: "A trailing stop follows price up by a set distance and locks in profit automatically — you let the winner run and the exit ratchets up on its own, triggering only if price reverses by your trail amount." },
        { kind: "desk", instruction: "On the desk, place a stop on an open position, then practice thinking in brackets: before your next entry, write down the target and the stop first — the exchange can enforce what you decide in advance.", symbol: "NVDA" },
        { kind: "flashcards", title: "Advanced orders",
          cards: [
            { front: "Stop-limit", back: "A stop that becomes a limit order — won't fill below your price, but might not fill at all." },
            { front: "Trailing stop", back: "A stop that follows price up by a fixed distance and never moves down — auto-locks gains." },
            { front: "Bracket order", back: "Entry, profit target, and stop-loss placed together as one plan." },
            { front: "OCO", back: "One-cancels-other — when the target or stop fills, the other cancels automatically." },
            { front: "Time-in-force", back: "How long an order stays live: Day, GTC (good-till-canceled), or IOC (immediate-or-cancel)." },
          ] },
      ],
    },
  ],
};
