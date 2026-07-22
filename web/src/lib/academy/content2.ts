import type { Track } from "./types";

/*
  Tracks 5–7: options, futures & macro, and running the book like a fund.
  This is the material people pay four figures for, taught the way a desk
  actually uses it.
*/

export const optionsTrack: Track = {
  id: "options",
  title: "Options — Greeks Without Mysticism",
  tagline: "Convexity, decay, and defined risk — the fund's toolkit",
  covers: "Options on stocks & ETFs (trading support: on the roadmap)",
  accent: "agent",
  lessons: [
    {
      id: "o1-contracts",
      title: "Calls, puts, and the shape of a payoff",
      hook: "An option is the right without the obligation — and that asymmetry is the entire product.",
      minutes: 11,
      xp: 80,
      sections: [
        { kind: "prose", text: "A call gives you the right to buy 100 shares at a fixed strike price before expiry; a put, the right to sell. Buy a 110-strike call on a $100 stock for $2 and your worst case is precisely $200 — the premium — while your upside opens without limit above $112. Draw the payoff and it's a hockey stick: flat loss until the strike, then a 45-degree line upward. Every option structure ever devised is just hockey sticks added together." },
        { kind: "prose", text: "The seller of that call took the mirror image: collects $200 now, keeps it if the stock stays below 110, and owes potentially unlimited value above. Selling options is selling insurance — steady premiums punctuated by the occasional hurricane. Neither side is 'smarter'; they're trading different shapes of risk. The buyer pays for convexity (small defined loss, large open gain). The seller harvests time. Know which shape you hold, always." },
        { kind: "formula", label: "Call payoff at expiry", expression: "P&L = max(S − K, 0) − premium", legend: "S: stock at expiry · K: strike · premium: what you paid. The max() is the asymmetry you bought." },
        { kind: "quiz", question: "You buy a $110 call for $2 (per share). At expiry the stock is $105. Your P&L per share:", choices: ["−$5", "−$2 — the premium, the whole premium, nothing but the premium", "+$3", "$0"], answer: 1, explain: "Below the strike the right to buy at 110 is worth zero, so you lose exactly what you paid. Defined risk means the worst case was signed up front." },
        { kind: "desk", instruction: "Sketch (paper is fine) the payoff of owning 100 shares vs owning one 110-call. Same bullish view, utterly different shapes of being wrong. Shape is the decision.", symbol: "AAPL" },
      ],
    },
    {
      id: "o2-value",
      title: "Intrinsic, extrinsic, and what you're really paying for",
      hook: "Most of an option's price is not value — it's possibility, and possibility has a decay schedule.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "An option's premium splits cleanly in two. Intrinsic value is what exercising would be worth right now (a 100-call on a $107 stock has $7 intrinsic). Everything else is extrinsic — the market's price for what might still happen before expiry. Extrinsic value grows with two things: time remaining (more time, more possibility) and implied volatility, the market's live forecast of how violently the stock could move." },
        { kind: "prose", text: "Implied volatility is where option traders actually trade. Buy an option before earnings when IV is inflated and you can be right about direction and still lose — the post-announcement IV crush deflates the possibility premium faster than the move inflates intrinsic. Professionals compare implied volatility against realized (what the stock actually does): buying when the market underprices future movement, selling when it overpays. Direction is the amateur game; volatility is the professional one." },
        { kind: "keyIdea", title: "You trade the forecast, not just the stock", text: "Every option price embeds a volatility forecast. Your edge isn't 'up or down' — it's 'the market thinks 2% moves; I think 4%.' That's a tradeable disagreement." },
        { kind: "quiz", question: "You buy a call the day before earnings. The stock rises 3% after the report — and your call loses money. What happened?", choices: ["Broker error", "IV crush: the possibility premium deflated more than intrinsic value grew", "Theta doubled", "The strike moved"], answer: 1, explain: "Pre-earnings IV priced in a big move; a merely decent one arrived. The extrinsic air came out of the balloon faster than the 3% filled it. You were right and still paid — welcome to volatility." },
        { kind: "desk", instruction: "The payoff sandbox arrives with options trading (roadmap). Until then: for any stock you follow, guess how much of a near-strike option's price would be pure possibility. Near earnings, it's most of it.", symbol: "NVDA" },
      ],
    },
    {
      id: "o3-delta-gamma",
      title: "Delta and gamma: your position is alive",
      hook: "Delta is your exposure. Gamma is how fast that exposure mutates while you're not looking.",
      minutes: 11,
      xp: 90,
      sections: [
        { kind: "prose", text: "Delta answers: if the stock moves $1, how much does my option move? A 0.50-delta call behaves like 50 shares. But delta itself moves — that's gamma. As the stock rallies toward your strike, a 0.30-delta call becomes 0.50, then 0.70: your effective share count grows as you win. Long options have positive gamma — the position leans into being right and away from being wrong. That self-improving behavior is exactly what the premium pays for." },
        { kind: "prose", text: "Sellers hold the mirror: negative gamma means their exposure grows as they lose — the short call behaves like a small short stock position that gets bigger the more the stock rallies. Scale that up and you get one of the market's real phenomena: dealers hedging short gamma must buy as prices rise and sell as they fall, amplifying moves. When a desk says 'the street is short gamma,' they mean the market's shock absorbers are installed backwards today." },
        { kind: "formula", label: "Share-equivalent exposure", expression: "exposure ≈ delta × 100 × contracts", legend: "Two 0.40-delta calls ≈ 80 shares of exposure — today. Gamma is the rate that number rewrites itself." },
        { kind: "quiz", question: "Long a 0.30-delta call; the stock rallies hard toward the strike. Your delta is now 0.55. What did gamma just do?", choices: ["Nothing — delta is fixed", "Grew your exposure while you were winning: you now 'own' ~55 shares' worth, up from 30", "Cut your exposure", "Turned it into a put"], answer: 1, explain: "Positive gamma compounds success: the more right you are, the more exposure you hold. It's the only instrument where winning automatically presses your bet." },
        { kind: "desk", instruction: "Compare mentally: 100 shares (delta 100, gamma 0) vs a call (delta 50, gamma positive). One exposure is a statue, one is a creature. Which do you want during a trend? During chop?", symbol: "TSLA" },
      ],
    },
    {
      id: "o4-theta-vega",
      title: "Theta and vega: rent and weather",
      hook: "Options are melting ice cubes traded in changing weather.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "Theta is the rent: how much extrinsic value evaporates per day if nothing else moves. It accelerates near expiry — an at-the-money option loses value slowly at 60 days and hemorrhages in the final two weeks. Own options and time is your landlord; sell them and you're collecting that rent, one calm day at a time. Every option position is implicitly a bet about whether the move arrives before the melt." },
        { kind: "prose", text: "Vega is the weather sensitivity: how much the price changes per point of implied volatility. Long options gain when fear rises even if the stock stands still; short options profit from calm arriving on schedule. This completes the professional's dashboard: delta (direction), gamma (acceleration), theta (rent), vega (weather). A position isn't 'a call' — it's +40 delta, +gamma, −$18/day theta, +$30/vol-point vega. Read positions in Greeks and you'll never again be surprised by your own P&L." },
        { kind: "keyIdea", title: "Name the bet before you place it", text: "Are you paying rent to own acceleration (long gamma, short theta)? Or collecting rent while short the storm (long theta, short gamma)? There is no third option — only people who haven't identified theirs." },
        { kind: "quiz", question: "Stock flat all week. IV collapses after a Fed meeting passes quietly. Your long straddle (call + put) loses 15%. Which Greeks billed you?", choices: ["Delta and gamma", "Theta charged rent daily and vega marked down the calm", "Just bad luck", "Rho"], answer: 1, explain: "Nothing moved (theta collected daily) and the storm premium deflated (vega). Straddles are a bet that motion beats melt — this week, melt won." },
        { kind: "desk", instruction: "Write in the journal which side of the rent you'd rather be on for the next 30 days — payer (long options) or collector (short) — and why. Update after the month. That loop is how volatility judgment gets built.", symbol: "SPY" },
      ],
    },
    {
      id: "o5-spreads",
      title: "Spreads: engineering the exact risk you want",
      hook: "Single options are blunt instruments. Spreads are surgery.",
      minutes: 11,
      xp: 90,
      sections: [
        { kind: "prose", text: "Combine hockey sticks and you can build almost any payoff. A vertical spread — buy the 100 call, sell the 110 call — costs less than the naked call because the sold leg finances the bought one; in exchange, gains cap at 110. You've traded unlimited upside (which you rarely capture anyway) for a cheaper, defined-risk, defined-reward bet. Max loss: net premium. Max gain: strike width minus premium. Both known before entry — the Risk track's dream." },
        { kind: "prose", text: "Every classic structure is a sentence in this grammar. Covered call: own shares, rent out the upside. Protective put: own shares, buy the insurance — earnings survival, purchased. Iron condor: sell a call spread and a put spread, betting the stock stays inside a range while both sides' theta pays you. None of these are exotic; they're the same four Greeks rearranged until the risk shape matches your actual opinion. Funds run books of these shapes the way a chef runs a pantry." },
        { kind: "formula", label: "Vertical spread boundaries", expression: "max loss = net debit · max gain = width − net debit", legend: "Buy 100C / sell 110C for $3 net: risk $300, potential $700, breakeven $103. The whole trade fits on an index card — that's the point." },
        { kind: "quiz", question: "You own 100 AAPL shares and fear the next month, but refuse to sell. The textbook defined-risk structure is:", choices: ["Buy more shares", "Buy a protective put — insurance with a known premium", "Sell a naked call on another stock", "Move to cash secretly"], answer: 1, explain: "The put caps your downside at its strike for a known cost, exactly like an insurance deductible. Portfolio protection is options' original, respectable job." },
        { kind: "desk", instruction: "Take your largest position and design (on paper) the protective put you'd buy before its next earnings: what strike, and what premium would you tolerate? Options trading lands on this desk soon — arrive knowing your structure.", symbol: "AAPL" },
      ],
    },
  ],
};

export const futuresTrack: Track = {
  id: "futures-macro",
  title: "Futures & the Macro Desk",
  tagline: "Leverage, carry, and hedging — how institutions actually move",
  covers: "Index, rates, commodity & FX futures (trading support: on the roadmap)",
  accent: "gain",
  lessons: [
    {
      id: "fu1-mechanics",
      title: "Futures mechanics: standardized promises with daily settling",
      hook: "A future is a handshake with a clearinghouse standing between the hands.",
      minutes: 11,
      xp: 80,
      sections: [
        { kind: "prose", text: "A futures contract is an agreement to buy or sell something at a set price on a set date — standardized so completely (size, grade, expiry) that the contracts themselves trade like stocks. The clearinghouse guarantees both sides, which is why strangers can trade billions without trusting each other. The crucial mechanical difference from stocks: futures settle daily. Every night, gains and losses move between accounts in cash — mark-to-market — so losses can't hide and accumulate invisibly." },
        { kind: "prose", text: "The leverage is structural, not optional. One E-mini S&P contract controls roughly $240k of index for about $12k of margin — 20:1 baked in. Each index point is worth $50 (the multiplier), so a routine 40-point day swings $2,000 per contract. Nobody 'adds leverage' to futures; you size DOWN from what the contract hands you. Every blown futures account is someone who took the structural leverage personally." },
        { kind: "formula", label: "Contract exposure", expression: "notional = price × multiplier", legend: "E-mini S&P at 4,800 × $50 = $240,000 of exposure per contract, controlled by ~$12k margin. The multiplier is the respect you owe." },
        { kind: "quiz", question: "You hold one E-mini S&P long ($50/point). The index drops 60 points today. Tonight, your account:", choices: ["Shows an unrealized paper loss", "Is debited $3,000 cash at settlement — mark-to-market is real money nightly", "Nothing until you sell", "Gains $3,000"], answer: 1, explain: "Futures settle daily in cash. There is no 'it's only a paper loss' in this market — the money leaves tonight, and margin calls follow it." },
        { kind: "desk", instruction: "Take today's SPY move, multiply by 10 (≈ the index), then by $50. That's one contract's day. Now decide honestly what fraction of a contract your current equity could professionally carry — fractions are legal here.", symbol: "SPY" },
      ],
    },
    {
      id: "fu2-hedging",
      title: "Hedging: the original point of the whole invention",
      hook: "Futures weren't invented to gamble on wheat. They were invented so the farmer could sleep.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "A farmer with wheat in the ground is long wheat whether they like it or not. Selling wheat futures locks in today's price for harvest: if wheat falls, the futures gain offsets the crop's loss; if wheat rallies, the crop's gain pays for the futures loss. Either way, the farmer swapped uncertainty for certainty — that's hedging: taking a deliberate position whose P&L runs opposite to a risk you already hold." },
        { kind: "prose", text: "A fund does the identical thing with an equity book. Long $10M of hand-picked stocks but nervous about the next month? Short index futures against it. The market's swings now wash out, and what remains is the difference between your stocks and the index — your actual skill, isolated. This is the 'hedge' in hedge fund, and the arithmetic of how many contracts is one division: portfolio beta-dollars over contract notional. The hedge doesn't make money; it buys the right to be judged only on what you claimed to be good at." },
        { kind: "formula", label: "Hedge ratio", expression: "contracts = (portfolio value × beta) ÷ notional per contract", legend: "$10M book, beta 1.1, E-mini notional $240k → hedge ≈ 46 contracts short. Rebalance as beta and prices drift." },
        { kind: "quiz", question: "Fully hedged (long stocks, short equivalent index futures), the market rallies 5% and your stocks rally 7%. Your P&L is approximately:", choices: ["+7%", "+2% — the market's 5% cancels, your 2% of stock-picking skill remains", "0%", "−5%"], answer: 1, explain: "The hedge surrendered the market's contribution in both directions. What's left — the 2% — is alpha, the only number a hedged fund is paid for." },
        { kind: "desk", instruction: "Compute your portfolio's rough 'market exposure': positions that move with SPY, summed. That number is what an index hedge would neutralize — and what your P&L currently borrows from the market's mood.", symbol: "SPY" },
      ],
    },
    {
      id: "fu3-curve",
      title: "Contango, backwardation, and the price of time",
      hook: "Futures don't have one price — they have a curve, and the curve's shape is a market opinion.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "Plot the same contract across expiries — this month, next, six out — and you get the term structure. When later months cost more (contango), the curve prices storage, insurance, and interest: the 'cost of carry.' When later months are cheaper (backwardation), the market pays a premium for the thing right now — usually scarcity talking. Oil in a supply shock backwardates; gold, which costs money to vault and yields nothing, lives in contango almost permanently." },
        { kind: "prose", text: "The curve quietly taxes or pays anyone holding exposure across time. A fund long oil via futures must roll each expiring contract into the next; in contango they sell low and buy high every roll — a steady bleed called negative roll yield that has hollowed out many a 'commodity ETF' unaware of its own plumbing. In backwardation, rolling pays. Professionals don't ask 'is oil going up?' — they ask 'what does holding this exposure cost per month, and does my thesis outrun the toll?'" },
        { kind: "keyIdea", title: "Carry is the silent P&L", text: "Every position across time has a carry: futures roll, margin interest, option theta, dividends. Funds compute it before entry, because carry compounds whether or not the thesis works." },
        { kind: "quiz", question: "Crude spot: $80. Next month future: $78. The curve is in:", choices: ["Contango", "Backwardation — the market pays up for oil NOW, and rolling longs get paid", "Equilibrium", "Error"], answer: 1, explain: "Later delivery trading under spot means immediate supply is precious — classic scarcity signature. Rolling a long here sells high, buys low: positive carry." },
        { kind: "desk", instruction: "Carry-thinking transfers everywhere: list what your current positions cost or pay per month just to hold (margin interest, staking yield, nothing). Positions with negative carry need theses with deadlines.", symbol: "BTC/USD" },
      ],
    },
    {
      id: "fu4-macro",
      title: "The macro dashboard: rates, the dollar, and everything else",
      hook: "Four dials move every market you'll ever trade. Learn to read the cockpit.",
      minutes: 11,
      xp: 90,
      sections: [
        { kind: "prose", text: "Interest rates are gravity: they're the discount rate from the stocks track, the carry cost from the last lesson, and the yield competing against every risky asset. When the 10-year Treasury pays 5%, a speculative stock's distant profits must fight a risk-free alternative; when it pays 1%, anything with a pulse gets funded. Central banks set the short rate; the bond market votes on the long one; the gap between them (the yield curve) is the market's recession forecast, published daily." },
        { kind: "prose", text: "The dollar is the second dial: most global trade, debt, and commodities are dollar-denominated, so a strong dollar tightens the world and pressures commodities and emerging markets; a weak one loosens it. Third dial, growth (earnings, employment, PMIs); fourth, liquidity (how much money the system is adding or draining). The macro desk's honest edge isn't predicting these dials — it's knowing which one their book secretly depends on. That awareness is what the correlation lesson looks like at institutional scale." },
        { kind: "keyIdea", title: "Know which dial your book is short", text: "Every portfolio has a macro weakness: rates spiking, dollar surging, growth cracking, liquidity draining. Name yours before the market names it for you." },
        { kind: "quiz", question: "The 10-year yield jumps from 3% to 5% over months. Which portfolio suffers the most structural damage?", choices: ["Short-duration value stocks with fat dividends", "Long-duration growth stocks whose cash flows live a decade out", "Cash", "Commodity producers"], answer: 1, explain: "It's the discount-rate lesson at market scale: the further out the promised cash, the harder a rising discount rate hits it. Duration isn't a bond word — every asset has it." },
        { kind: "desk", instruction: "Write one sentence per dial — rates, dollar, growth, liquidity — describing what each dial's bad day would do to your current book. Congratulations: that page is a macro risk report, the same one funds pay millions to produce.", symbol: "SPY" },
      ],
    },
  ],
};

export const fundTrack: Track = {
  id: "run-the-fund",
  title: "Run It Like a Fund",
  tagline: "Your book, your process, your analysts — the operating system",
  covers: "Portfolio construction · process · agents as your analyst team",
  accent: "agent",
  lessons: [
    {
      id: "h1-portfolio",
      title: "Portfolio construction: you are the risk committee now",
      hook: "A fund is not a pile of trades. It's an argument with an org chart.",
      minutes: 11,
      xp: 90,
      sections: [
        { kind: "prose", text: "A professional book starts from the top down: how much total risk am I running (gross exposure — everything long plus everything short), and how much of the market's mood am I wearing (net exposure — longs minus shorts)? A fund that's 130% long and 70% short is 200% gross, 60% net: aggressive in positions, moderate in market direction. These two numbers are the first thing any allocator asks and the last thing most retail traders ever compute." },
        { kind: "prose", text: "Below the top sit budgets: per-theme limits (the correlation lesson, enforced), per-position maximums (no single idea gets to kill the fund), and a drawdown protocol (the risk track, made law). The uncomfortable discipline is that portfolio rules outrank conviction — the more you love a position, the more precisely it must fit the budget, because love is where discipline goes to die. Every legendary blowup in fund history is a risk committee that lost an argument to a star trader." },
        { kind: "formula", label: "The two exposures", expression: "gross = |longs| + |shorts| · net = longs − shorts", legend: "Gross measures how much game you're playing; net measures how much you're betting on the market itself showing up." },
        { kind: "quiz", question: "Book: $80k long tech, $30k short retail, $50k cash equivalent. Gross and net exposure on $100k?", choices: ["110% gross, 50% net", "80% / 80%", "50% / 110%", "30% / 30%"], answer: 0, explain: "Gross = 80 + 30 = 110%. Net = 80 − 30 = 50%. You're playing an aggressive amount of game (110%) with a moderate market bet (50%) — a real long/short profile." },
        { kind: "desk", instruction: "Compute your own two numbers right now from the positions panel. Gross and net. Write them in the journal weekly — you've just instituted your fund's first risk report.", symbol: "SPY" },
      ],
    },
    {
      id: "h2-process",
      title: "Process beats prediction: the journal is the fund",
      hook: "Funds don't pay analysts to be right. They pay them to be checkable.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "Every institutional trade travels with paperwork: thesis, entry, invalidation, size rationale, exit plan — written before the order, reviewed after the close. This isn't bureaucracy; it's the only known technology for separating skill from luck. A winning trade with no thesis is luck wearing your clothes. A losing trade that followed the process is tuition. Over a hundred trades, the journal's R-multiples and hit rates become a mirror no self-image survives intact — which is precisely its value." },
        { kind: "prose", text: "The post-mortem question that builds traders isn't 'did it work?' but 'was it a good decision with the information available?' Good decisions with bad outcomes deserve repetition; bad decisions with good outcomes are the most dangerous events in your career, because they pay you to learn the wrong lesson. Your journal here auto-attaches entry, exit, and P&L to every close. The thesis column is yours to fill — it's the only column the market can't fill for you." },
        { kind: "keyIdea", title: "Grade decisions, not outcomes", text: "Outcome = decision quality + variance. You only control the first term. A process journal is how you stop paying variance a salary." },
        { kind: "quiz", question: "Trade A: no thesis, random entry, +8R lucky win. Trade B: full process, respected stop, −1R loss. Which improved your fund?", choices: ["A — money is money", "B — it bought information and preserved discipline; A taught a lie and will resell it to you at size", "Neither", "Both equally"], answer: 1, explain: "A's +8R came bundled with the lesson 'process is optional' — a lesson that compounds negatively forever. B cost 1R and strengthened the machine that produces all future returns." },
        { kind: "desk", instruction: "Open your journal. For your last closed trade, write the thesis you SHOULD have written before entry — honestly, including if there wasn't one. That sting is the beginning of process.", symbol: "AAPL" },
      ],
    },
    {
      id: "h3-agents",
      title: "Agents are your analysts — hire, test, and fire them like one",
      hook: "A fund scales by hiring judgment. You scale by programming it.",
      minutes: 10,
      xp: 90,
      sections: [
        { kind: "prose", text: "The Agent Lab is your analyst floor. Each agent is a junior with exactly one idea — 'buy the 20/50 cross, exit on the break' — executed with perfect discipline and zero imagination. That's the correct division of labor: humans set strategy, budgets, and vetoes; machines execute rules without boredom, fear, or revenge trades. Every order an agent places is tagged and narrated, because a fund where you can't audit your analysts isn't a fund — it's a casino with extra steps." },
        { kind: "prose", text: "Hiring standards apply. An agent must pass an honest backtest — and honest means out-of-sample: we fit nothing on the last 30% of history, then grade there, where the agent couldn't have memorized the answers. In-sample 71%, out-of-sample 58%? Normal decay. Out-of-sample coin-flip? That's an overfit resume — a candidate who memorized the interview questions. And every agent carries a drawdown limit that halts it automatically: even your best analyst doesn't get to lose unsupervised. The kill switch is yours; hold it without sentiment." },
        { kind: "keyIdea", title: "Out-of-sample or it didn't happen", text: "Any strategy can ace history it was tuned on. The only grade that matters is on data it never saw — demand it from every agent, every backtest, every guru." },
        { kind: "quiz", question: "An agent backtests 94% in-sample and 51% out-of-sample. The verdict:", choices: ["Deploy — 94% is stellar", "Overfit — it memorized the past and learned nothing general; the 51% is its real resume", "Average the two: 72%", "Run it with double allocation"], answer: 1, explain: "The gap IS the diagnosis. In-sample brilliance with out-of-sample coin-flipping means the rules encode noise, not signal. Real edges decay gracefully; frauds decay instantly." },
        { kind: "desk", instruction: "When the Agent Lab opens on this desk, your first hire is waiting: a simple moving-average agent on one symbol, smallest allocation, drawdown limit set. Watch it work for a week before giving it a raise.", symbol: "NVDA" },
      ],
    },
    {
      id: "h4-your-fund",
      title: "Your personal hedge fund: the operating rhythm",
      hook: "You now know more than most licensed professionals apply. What remains is cadence.",
      minutes: 9,
      xp: 100,
      sections: [
        { kind: "prose", text: "Assemble everything: a weekly rhythm. Monday, macro dials and the week's scheduled earthquakes (earnings, central banks). Daily, positions against their theses — not against your mood. Per trade: thesis written, size computed from stop distance, R logged at close. Weekly, the fund report to your only investor — you: gross, net, drawdown from peak, R distribution, one process improvement. Monthly, agent performance reviews: who keeps their allocation, who gets the switch." },
        { kind: "prose", text: "This rhythm is the actual difference between an account and a fund. Not capital — process. The CFA curriculum teaches valuation, portfolio theory, and derivatives across three exams and 900 hours; you've just walked its practical spine with live ammunition and a simulator that charges honest slippage. What no curriculum supplies is the sitting-still discipline of running the rhythm through boredom, euphoria, and drawdown. The simulator's $100k is a rehearsal space for exactly that. Rehearse until the rhythm is who you are — then the instruments (futures, options, margin) arriving on this desk will find a professional waiting." },
        { kind: "keyIdea", title: "The fund is the habit, not the money", text: "Strategy is a sentence. Risk is arithmetic. Process is a calendar. Run all three for a year and you'll be in a smaller club than any credential admits." },
        { kind: "quiz", question: "What separates a personal hedge fund from a brokerage account?", choices: ["More money", "Leverage access", "A written process: exposure budgets, theses, R-tracking, reviews — run on a calendar", "Bloomberg terminals"], answer: 2, explain: "Funds are process machines that happen to hold positions. Capital scales the machine; it never substitutes for it." },
        { kind: "desk", instruction: "Write your fund's one-page charter in the journal: max drawdown, per-theme budget, weekly review day, and the sentence you'll reread during your first −10%. Sign it. You're the manager now.", symbol: "SPY" },
      ],
    },
  ],
};
