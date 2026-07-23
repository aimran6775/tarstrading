import type { Track } from "./types";

/*
  Stage 1 — Markets 101, rebuilt interactive. The first hour of Tars Academy:
  no prior knowledge assumed, every idea has an analogy, and you DO something
  on every screen — flip a candle, read a chart, size a trade, play a drill.
  This is the template the other nine stages follow.
*/

export const marketsTrack: Track = {
  id: "s1-markets",
  title: "Markets 101",
  tagline: "What a market is, how a price is born, and the one habit that keeps you alive.",
  covers: "the absolute basics",
  accent: "gold",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "m1-what-is-a-market",
      title: "What a market really is",
      hook: "Strip away the jargon and a market is the oldest human invention there is.",
      minutes: 12,
      xp: 60,
      sections: [
        { kind: "analogy", title: "It's a farmers' market with a scoreboard",
          text: "Picture a market square. Sellers shout the lowest price they'll accept; buyers offer the highest they'll pay. A deal happens the instant those two numbers touch. A stock market is exactly this — just faster, global, and with a live scoreboard called the price." },
        { kind: "prose", text: "A market is simply a place where buyers and sellers meet to agree on a price. Nobody sets the price from above. It's discovered, moment to moment, by people voting with their money. Every trade is two people who disagree about the future — the buyer thinks it's going up, the seller thinks it's going down — and only time tells who was right." },
        { kind: "chart", variant: "spread",
          caption: "A real market is a stack of offers on both sides. Buyers (bids) below, sellers (asks) above. The best of each is where the action is." },
        { kind: "keyIdea", title: "Price is an opinion, volume is a fact",
          text: "The price tells you what the last two people agreed on. How MUCH traded at that price tells you how many people cared. Learn to watch both." },
        { kind: "quiz",
          question: "Who decides the price of a stock?",
          choices: ["The company's CEO", "A government regulator", "Buyers and sellers, trade by trade", "The stock exchange sets it each morning"],
          answer: 2,
          explain: "No one 'sets' it. The price is just the most recent point where a buyer and a seller agreed. It changes every time a new deal happens." },
        { kind: "flashcards", title: "Lock in the terms",
          cards: [
            { front: "Market", back: "A place (physical or electronic) where buyers and sellers meet to agree on prices." },
            { front: "Bid", back: "The highest price a buyer is currently willing to pay." },
            { front: "Ask (offer)", back: "The lowest price a seller is currently willing to accept." },
            { front: "Volume", back: "How many shares traded — a measure of how much interest there is." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m2-bid-ask-spread",
      title: "Bid, ask, and the spread",
      hook: "The gap between buyers and sellers is a tollbooth — and you pay it every time you trade.",
      minutes: 13,
      xp: 70,
      sections: [
        { kind: "prose", text: "At any instant there are two prices, not one. The bid is the most anyone will pay right now. The ask is the least anyone will sell for right now. They're almost never equal — there's a small gap between them called the spread." },
        { kind: "chart", variant: "spread",
          caption: "Best bid 24.98, best ask 25.02. That 4-cent gap is the spread — the built-in cost of getting in and out." },
        { kind: "formula", label: "The spread", expression: "spread = best ask − best bid",
          legend: "Tighter spreads (a penny or two) mean a liquid, healthy market. Wide spreads mean few participants — and a bigger toll to cross." },
        { kind: "analogy", title: "Like exchanging currency at the airport",
          text: "The board shows one rate to buy and a worse rate to sell. That gap is how the booth makes money. In markets, crossing the spread is the unavoidable little tax you pay for immediacy." },
        { kind: "keyIdea", title: "You buy at the ask, you sell at the bid",
          text: "So the moment you buy, you're already down by the spread. On liquid names it's pennies. On thin ones it can quietly cost you more than the trade was worth." },
        { kind: "quiz",
          question: "Best bid is $50.00 and best ask is $50.10. You buy now, then sell instantly. What happens?",
          choices: ["You break even", "You're down about $0.10 per share — the spread", "You make $0.10 per share", "The trade is rejected"],
          answer: 1,
          explain: "You bought at the ask (50.10) and sold at the bid (50.00). The 10-cent spread is the round-trip cost — before any commissions." },
        { kind: "flashcards", title: "Review",
          cards: [
            { front: "Spread", back: "The gap between the best bid and best ask — the cost of crossing the market." },
            { front: "Liquidity", back: "How easily you can trade without moving the price. Tight spread + high volume = liquid." },
            { front: "Slippage", back: "Getting a worse price than you expected because the market moved or was thin." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m3-reading-a-chart",
      title: "Reading your first chart",
      hook: "One candle holds four numbers. Learn to read it and a chart starts to talk.",
      minutes: 14,
      xp: 80,
      sections: [
        { kind: "prose", text: "A price chart is just history drawn as a picture. The most common style is the candlestick — each candle packs a whole time period (a day, an hour, a minute) into one shape. Tap between an up day and a down day below and watch what changes." },
        { kind: "chart", variant: "candle-anatomy",
          caption: "Four numbers per candle: open, high, low, close. The body is open-to-close; the thin wicks are how far price stretched and got rejected." },
        { kind: "analogy", title: "A candle is a tug-of-war, frozen",
          text: "The body shows who won the period — buyers (green) or sellers (red). Long wicks are the rope-burns: price went there, then got yanked back. A long lower wick means buyers fought back hard." },
        { kind: "prose", text: "Zoom out from single candles and the shape of the whole tells you the market's mood. There are only three states, and knowing which one you're in is half of trading." },
        { kind: "chart", variant: "trend",
          caption: "Toggle the three states. Uptrend = higher highs and higher lows. Downtrend = the reverse. Range = stuck between a floor and a ceiling." },
        { kind: "game", variant: "bull-or-bear", title: "Read the structure" },
        { kind: "quiz",
          question: "A candle has a small green body near the top and a long lower wick. What does the wick tell you?",
          choices: ["Sellers were in complete control", "Price dropped, but buyers stepped in and pushed it back up", "Nothing — wicks are random", "The market was closed"],
          answer: 1,
          explain: "The long lower wick means price fell during the period, then buyers overwhelmed sellers and drove it back up to close near the high. That's a sign of buying interest." },
        { kind: "flashcards", title: "Candles & structure",
          cards: [
            { front: "Candlestick", back: "A bar showing the open, high, low, and close of one time period." },
            { front: "Body", back: "The thick part — the distance from open to close." },
            { front: "Wick / shadow", back: "The thin lines — the highest and lowest prices reached." },
            { front: "Uptrend", back: "A series of higher highs and higher lows — buyers in control." },
            { front: "Range", back: "Price bouncing between a support floor and a resistance ceiling." },
          ] },
        { kind: "desk", instruction: "Open a real chart and switch timeframes. Notice how the same stock looks calm on the 1-year and jumpy on the 1-day — timeframe is a lens.", symbol: "AAPL" },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "m4-stay-alive",
      title: "The habit that keeps you alive",
      hook: "Before any strategy, learn the one thing every blown-up account skipped: sizing.",
      minutes: 15,
      xp: 90,
      sections: [
        { kind: "prose", text: "Here's the secret the pros learn first and amateurs learn last: your job isn't to be right, it's to survive being wrong. You do that by deciding — before you enter — exactly how much you'll lose if the trade fails. That amount should be small and fixed. Then you work backward to how many shares that allows." },
        { kind: "keyIdea", title: "Risk a fixed slice, never a fixed share count",
          text: "Pros risk a small, constant fraction of the account per trade — often 1%. Not 'I'll buy 100 shares.' The share count falls out of the math once you know your account, your risk, and your stop." },
        { kind: "calc", tool: "position-size", title: "Size a trade — drag the inputs" },
        { kind: "prose", text: "Now the other half: is the trade even worth taking? Compare what you're risking to what you could make. If you risk $1 to make $3, you can be wrong most of the time and still come out ahead." },
        { kind: "calc", tool: "risk-reward", title: "Risk vs reward" },
        { kind: "game", variant: "size-it", title: "Size it yourself" },
        { kind: "keyIdea", title: "Survival first, profit second",
          text: "A trader who never risks more than 1% can be wrong ten times in a row and still have ~90% of their account. A trader who bets big is one bad streak from zero. Boring math is how you stay in the game long enough to get good." },
        { kind: "widget", variant: "first-trade" },
        { kind: "desk", instruction: "On the desk, the ticket shows a buying-power meter for exactly this reason. Try sizing a small position and watch it — feel the difference between a 2% position and a 40% one.", symbol: "NVDA" },
        { kind: "flashcards", title: "The survival kit",
          cards: [
            { front: "Position sizing", back: "Choosing how many shares to buy so that a loss costs a fixed, small amount." },
            { front: "Risk per trade", back: "The dollar amount you'll lose if the stop is hit — usually a small % of the account." },
            { front: "Stop loss", back: "A pre-set price where you exit a losing trade, no arguing." },
            { front: "R : R (risk/reward)", back: "How much you can make vs how much you risk. 2:1 or better is the usual bar." },
            { front: "Expectancy", back: "Average profit per trade over many trades: win% × avg win − loss% × avg loss." },
          ] },
      ],
    },
  ],
};
