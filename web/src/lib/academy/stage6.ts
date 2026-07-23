import type { Track } from "./types";

/*
  Stage 6 — Stocks & the Market. What you're actually buying, how the market is
  organized (indices, ETFs, sectors), what moves a stock (earnings & catalysts),
  and the two ways to add firepower: shorting and margin — with the risks
  spelled out.
*/

export const stocksStage: Track = {
  id: "s6-stocks",
  title: "Stocks & the Market",
  tagline: "What a share really is, how the market is wired, and the firepower of shorting and margin.",
  covers: "equities",
  accent: "gain",
  lessons: [
    // ---------------------------------------------------------------
    {
      id: "st1-what-is-a-share",
      title: "What you actually own",
      hook: "A share isn't a lottery ticket. It's a slice of a real business.",
      minutes: 12,
      xp: 80,
      sections: [
        { kind: "analogy", title: "A pizza cut into a billion slices",
          text: "A company is a pizza; shares are the slices. Own 100 slices of a billion-slice pizza and you own a tiny, real piece of the whole thing — its profits, its assets, its future. The price of a slice moves with what people think the pizza is worth." },
        { kind: "prose", text: "When you buy a share, you become a part-owner of a business. If the company grows and earns more, your slice becomes worth more, and it may pay you a cut of the profits (a dividend). Stock prices swing on one question, asked millions of times a day: is this business worth more or less than we thought? Everything else — news, earnings, hype — is just people updating that answer." },
        { kind: "chart", variant: "trend",
          caption: "A share price is the market's running vote on a company's future. Uptrend = the crowd getting more optimistic." },
        { kind: "keyIdea", title: "Price and value are not the same thing",
          text: "Price is what you pay; value is what it's worth. In the short run, price is a popularity contest driven by emotion. Over the long run, it tends to track the actual business. The gap between the two is where both opportunity and danger live." },
        { kind: "quiz",
          question: "What do you own when you buy a share of a company?",
          choices: ["A loan to the company", "A fractional ownership stake in the business", "A guarantee of profit", "A physical asset stored at the exchange"],
          answer: 1,
          explain: "A share is fractional ownership — a real slice of the company's assets and future profits. It's equity, not a loan (that's a bond), and it carries no guarantee." },
        { kind: "flashcards", title: "Shares",
          cards: [
            { front: "Share / stock", back: "A unit of ownership in a company." },
            { front: "Dividend", back: "A slice of profits paid out to shareholders." },
            { front: "Market cap", back: "Share price × total shares — the market's price tag for the whole company." },
            { front: "Price vs value", back: "Price is what you pay; value is what the business is worth." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "st2-indices-etfs",
      title: "Indices, ETFs & sectors",
      hook: "You don't have to pick one company. You can buy the whole market in a click.",
      minutes: 12,
      xp: 80,
      sections: [
        { kind: "prose", text: "An index is a scoreboard for a slice of the market — the S&P 500 tracks 500 big US companies, so it's a shorthand for 'how are big US stocks doing?' You can't buy an index directly, but you can buy an ETF (exchange-traded fund) that holds all those stocks for you. One purchase, instant diversification across hundreds of companies." },
        { kind: "analogy", title: "A playlist instead of one song",
          text: "Buying a single stock is betting on one song being a hit. Buying an index ETF is buying the whole playlist — some tracks flop, some soar, and you get the average. Less thrilling, far less likely to leave you with nothing." },
        { kind: "keyIdea", title: "Sectors move in herds",
          text: "Stocks cluster into sectors — tech, energy, healthcare, financials. When rates rise, banks often rally and high-growth tech often sinks, together. Knowing which herd a stock runs with tells you half of why it's moving before you read a single headline." },
        { kind: "widget", variant: "correlation" },
        { kind: "prose", text: "Slide that toward the top and you're looking at two stocks in the same sector: they rise and fall as one herd. That's the quiet catch with an index ETF too — it's diversified across companies, but if they're all big US tech, a single rate shock can still move the whole basket together. Diversification across names isn't the same as diversification across risks." },
        { kind: "quiz",
          question: "What's the main advantage of buying an index ETF over a single stock?",
          choices: ["Guaranteed higher returns", "Instant diversification across many companies in one purchase", "No fees ever", "It can't go down"],
          answer: 1,
          explain: "An index ETF spreads your money across all the companies in the index, so no single company's collapse wrecks you. It trades diversification for the chance of a single stock's home-run — usually a smart trade." },
        { kind: "flashcards", title: "Market structure",
          cards: [
            { front: "Index", back: "A scoreboard tracking a basket of stocks (e.g. S&P 500)." },
            { front: "ETF", back: "A fund you buy like a stock that holds a whole basket — instant diversification." },
            { front: "Sector", back: "A group of related companies (tech, energy…) that often move together." },
            { front: "Diversification", back: "Spreading risk across many holdings so no single one can sink you." },
          ] },
        { kind: "desk", instruction: "Pull up SPY (the S&P 500 ETF) and QQQ (big tech). Compare their charts — notice when they move together and when tech runs hotter or colder than the broad market.", symbol: "SPY" },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "st3-catalysts",
      title: "What moves a stock",
      hook: "Prices don't move on facts. They move on surprises.",
      minutes: 13,
      xp: 85,
      sections: [
        { kind: "prose", text: "A stock's price already reflects what everyone expects. It moves when reality differs from that expectation — a surprise. This is why a company can report record profits and the stock falls: if the market expected even more, record profits are a disappointment. Trade the surprise, not the news." },
        { kind: "keyIdea", title: "Earnings: the four-times-a-year reckoning",
          text: "Every quarter, public companies report results. If they beat expectations, the stock often jumps; miss, and it can crater — sometimes 10-20% overnight. Earnings days are the biggest scheduled catalysts, and also the most dangerous: the move is violent and the direction is a coin flip until the numbers land." },
        { kind: "prose", text: "Beyond earnings, catalysts are anything that changes the story: a new product, a lawsuit, an analyst upgrade, a Fed rate decision, a CEO leaving. The common thread — they shift expectations about future profits. The bigger the surprise versus what was priced in, the bigger the move." },
        { kind: "game", variant: "bull-or-bear", title: "Read the reaction" },
        { kind: "quiz",
          question: "A company beats earnings estimates but the stock drops 8%. What's the most likely reason?",
          choices: ["The report was fake", "Expectations were even higher, or guidance disappointed — the beat wasn't enough", "Beats always cause drops", "Someone made an error"],
          answer: 1,
          explain: "The market prices in expectations ahead of time. If it expected a bigger beat, or the company's outlook (guidance) was weak, even good numbers disappoint. Price moves on the gap between reality and expectation." },
        { kind: "flashcards", title: "Catalysts",
          cards: [
            { front: "Catalyst", back: "An event that changes the market's expectations for a stock." },
            { front: "Earnings", back: "Quarterly profit reports — the biggest scheduled catalyst." },
            { front: "Guidance", back: "A company's own forecast — often moves the stock more than the results." },
            { front: "Priced in", back: "When the expected news is already reflected in the price." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "st4-shorting-margin",
      title: "Shorting & margin: firepower and fire",
      hook: "Two tools that multiply your reach — and your risk. Respect both.",
      minutes: 14,
      xp: 90,
      sections: [
        { kind: "prose", text: "So far you've bet on prices going up. Short selling lets you bet on them going DOWN: you borrow shares, sell them now, and hope to buy them back cheaper later, pocketing the difference. It's how traders profit in falling markets — but the risk is inverted and dangerous." },
        { kind: "keyIdea", title: "Shorting has unlimited risk",
          text: "When you buy a stock, the worst case is it goes to zero — you lose 100%. When you short, the stock can rise forever, so your loss is unlimited. A short squeeze — everyone rushing to buy back at once — can rocket a price and wipe out shorts in hours. Short with a hard stop, always." },
        { kind: "prose", text: "Margin is borrowing money from your broker to buy more than your cash allows. It multiplies gains — and losses — by the same factor. Use 2x margin and a 10% drop becomes a 20% loss on your money. If losses breach a threshold, the broker issues a margin call: add cash now or they sell your positions at the worst possible moment." },
        { kind: "analogy", title: "Margin is a chainsaw",
          text: "It does real work fast — and takes your hand off just as fast if you're careless. Professionals use leverage sparingly and with a plan. Beginners who reach for it to 'make back' a loss usually accelerate the trip to zero." },
        { kind: "calc", tool: "position-size", title: "Size a short — the stop does the work" },
        { kind: "prose", text: "The sizing math is identical whether you're long or short: your stop distance and your 1% risk decide the size — the leverage never does. That's the whole discipline. Margin lets you hold a bigger position; it does not let you risk more than 1%. If a leveraged position forces you past your risk limit, the position is too big, full stop." },
        { kind: "quiz",
          question: "Why is short selling riskier than buying?",
          choices: ["Fees are higher", "A stock you're short can rise without limit, so your loss is unlimited", "You can't use a stop", "It's illegal for retail traders"],
          answer: 1,
          explain: "A long position's worst case is −100% (the stock hits zero). A short has no ceiling on losses — the stock can keep rising, and a squeeze can do it violently. Unlimited risk demands hard stops." },
        { kind: "flashcards", title: "Leverage tools",
          cards: [
            { front: "Short selling", back: "Borrowing and selling a stock to profit if it falls — unlimited risk." },
            { front: "Short squeeze", back: "A sharp rally as shorts rush to buy back, forcing the price higher." },
            { front: "Margin", back: "Borrowing from your broker to trade larger — multiplies gains AND losses." },
            { front: "Margin call", back: "A demand to add cash when leveraged losses breach a threshold." },
          ] },
      ],
    },
  ],
};
