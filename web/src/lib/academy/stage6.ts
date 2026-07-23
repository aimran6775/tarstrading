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

    // ---------------------------------------------------------------
    {
      id: "st5-crypto",
      title: "Crypto: the market that never sleeps",
      hook: "Same skills, wilder weather. Crypto trades the way stocks do — just 24/7 and twice as fast.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "Crypto is where a lot of people first meet trading, and the good news is that everything you've learned still applies: a price is a price, a chart is a chart, risk is still 1%. What's different is the environment. Crypto markets never close — no bell, no weekends off — and they move with a volatility that would be a once-a-decade event in blue-chip stocks. The rules don't change; the weather does." },
        { kind: "analogy", title: "The 24/7 city",
          text: "Stocks are a town that closes at night — you sleep, the market sleeps. Crypto is a city that never turns off: something is always happening, somewhere, and a big move can arrive at 3am on a Sunday. That's freedom and it's a trap — the market doesn't wait for you to be awake, which is exactly why pre-set stops matter even more here." },
        { kind: "keyIdea", title: "Higher volatility means smaller size, not bigger bets",
          text: "The beginner sees crypto's big swings and sizes up to chase them. The professional sees the same swings and sizes DOWN — because your stop distance is wider when the asset moves 10% in a day, and wider stops mean fewer shares (or coins) for the same 1% risk. Volatility is a reason to be smaller, never larger. The math from Stage 4 is your seatbelt." },
        { kind: "prose", text: "A few crypto-specific terms worth knowing: a stablecoin is a token pegged to a dollar, used as cash between trades; a wallet holds your coins (on an exchange, or self-custodied); and 'on-chain' means settled on the blockchain itself. On the desk, you trade crypto as simply as stocks — BTC/USD and ETH/USD behave like any other symbol, quotes stream live, and the same order ticket applies. The skill transfers completely." },
        { kind: "quiz",
          question: "Bitcoin is far more volatile than a blue-chip stock. How should that change your position size?",
          choices: ["Size up — bigger swings, bigger profits", "Size down — a wider stop means fewer coins for the same 1% risk", "It shouldn't change anything", "Stop using a stop"],
          answer: 1,
          explain: "Higher volatility means a wider stop, and a wider stop means a smaller position for the same fixed risk. Crypto's swings are a reason to be smaller, not bigger — the sizing math protects you exactly when the asset is wild." },
        { kind: "desk", instruction: "Open BTC/USD on the desk. Notice the live quote never stops moving, even off-hours. Size any hypothetical trade from a stop — the wider the swing, the smaller the position.", symbol: "BTC/USD" },
        { kind: "flashcards", title: "Crypto",
          cards: [
            { front: "Crypto market hours", back: "24/7/365 — no close, no weekends. Moves can arrive any time." },
            { front: "Stablecoin", back: "A token pegged to a currency (usually the dollar) — used as cash between trades." },
            { front: "Wallet", back: "Where crypto is held — on an exchange, or self-custodied by you." },
            { front: "Volatility → size", back: "Wilder swings mean wider stops mean smaller positions for the same risk." },
            { front: "Skill transfer", back: "Charts, orders, and risk work identically in crypto — only the volatility and hours differ." },
          ] },
      ],
    },

    // ---------------------------------------------------------------
    {
      id: "st6-account",
      title: "How a real account actually works",
      hook: "The unglamorous plumbing — settlement, day-trade rules, taxes — that trips up more beginners than any chart.",
      minutes: 12,
      xp: 85,
      sections: [
        { kind: "prose", text: "You can read charts perfectly and still get blindsided by the mechanics of a real brokerage account. This stuff is boring, which is exactly why nobody learns it until it bites them. A few rules are worth knowing before real money is involved — on the simulator none of these apply, but the day you go live, they will." },
        { kind: "keyIdea", title: "Settlement: your cash isn't instant",
          text: "When you sell, the cash isn't truly yours until the trade 'settles' — currently the next business day (T+1) for US stocks. Trade with unsettled funds too aggressively in a cash account and you can trigger a 'good-faith violation.' Most active traders use a margin account partly to sidestep the wait, but then margin's own rules apply." },
        { kind: "keyIdea", title: "The Pattern Day Trader rule",
          text: "In the US, if you make four or more day trades (in and out the same day) within five business days in a margin account, you're flagged a 'Pattern Day Trader' and must keep at least $25,000 in the account. Fall below and your day-trading is restricted. It surprises a lot of new active traders — know it before you build a strategy that needs many same-day trades." },
        { kind: "keyIdea", title: "Taxes and the wash-sale rule",
          text: "Profits are taxable — and holding period matters: gains on positions held under a year are usually taxed higher (short-term) than those held longer. One trap to know: the wash-sale rule disallows claiming a loss if you rebuy the same security within 30 days, so a loss you were counting on for taxes can be deferred. None of this is advice — it's a flag to keep records and ask a professional when real money is involved." },
        { kind: "quiz",
          question: "In a US margin account, what does the Pattern Day Trader rule require?",
          choices: ["A $500 minimum", "At least $25,000 to keep day-trading after 4+ day trades in 5 days", "That you only trade crypto", "Nothing — it's optional"],
          answer: 1,
          explain: "Four or more day trades within five business days flags you as a Pattern Day Trader, and you must maintain $25,000 in equity to keep day-trading. Below that, day trades are restricted. Worth knowing before you design a high-frequency strategy." },
        { kind: "prose", text: "The reason Tars is paper-only for now is exactly so you can learn every skill in this academy without any of this plumbing getting in the way. Master the trading first; the account mechanics are a solvable checklist you handle once, later, when real capital is on the line." },
        { kind: "flashcards", title: "Account mechanics",
          cards: [
            { front: "Settlement (T+1)", back: "Cash from a sale is final the next business day — not instantly available in a cash account." },
            { front: "Pattern Day Trader rule", back: "4+ day trades in 5 days (US margin) requires a $25,000 minimum balance." },
            { front: "Short vs long-term gains", back: "Positions held under a year are usually taxed at a higher rate." },
            { front: "Wash-sale rule", back: "You can't claim a loss if you rebuy the same security within 30 days." },
            { front: "Cash vs margin account", back: "Cash waits for settlement; margin lends you buying power, with its own rules." },
          ] },
      ],
    },
  ],
};
