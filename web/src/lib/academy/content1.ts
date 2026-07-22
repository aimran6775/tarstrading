import type { Track } from "./types";

/*
  Tracks 1–4: markets, price, risk, stocks & margin.
  Voice: a mentor who has sat at the desk. Plain language, real numbers,
  zero mysticism. Every lesson ends at the terminal, because knowing and
  doing are different skills.
*/

export const foundationsTrack: Track = {
  id: "foundations",
  title: "Foundations of Markets",
  tagline: "What is actually happening when a price moves",
  covers: "Every instrument starts here",
  accent: "gold",
  lessons: [
    {
      id: "f1-what-a-market-is",
      title: "A market is an argument about price",
      hook: "Every tick you'll ever trade is two strangers disagreeing in public.",
      minutes: 8,
      xp: 50,
      sections: [
        { kind: "prose", text: "Strip away the charts, the news, the jargon, and a market is one mechanism: an auction that never closes. Buyers post the most they'll pay (bids). Sellers post the least they'll accept (asks). The gap between the best bid and the best ask is the spread, and the last price you see on every chart is simply the most recent time someone got impatient enough to cross it." },
        { kind: "prose", text: "That impatience has a name: taking liquidity. If you buy at the ask, you take; whoever posted that ask was making. Makers earn the spread for waiting; takers pay it for speed. Every strategy you will ever study — from a pension fund rebalancing to a scalper's five-second trade — is a decision about when speed is worth paying for. Hedge funds obsess over this because at their size, the spread and the market impact of their own orders can cost more than their research." },
        { kind: "keyIdea", title: "Price is the argument, volume is the conviction", text: "A price without volume behind it is one loud voice. Price moving on heavy volume is a crowd changing its mind — that's the signal professionals respect." },
        { kind: "quiz", question: "You buy 100 shares 'at market' and pay $50.02 when the last trade printed $50.00. What did you pay for?", choices: ["A broker fee", "Immediacy — you crossed the spread to trade now", "A tax", "Nothing; it's random noise"], answer: 1, explain: "The two cents is the cost of demanding to trade immediately instead of waiting at the bid. It's the oldest fee in markets, and it never shows up on a statement." },
        { kind: "desk", instruction: "Open AAPL on the terminal. Look at today's price, then place NO trade. Just watch it for one minute and name who might be on each side. The discipline of watching without acting is a position too.", symbol: "AAPL" },
      ],
    },
    {
      id: "f2-orders",
      title: "Orders are your only vocabulary",
      hook: "You can't say anything to a market except through an order — so learn to speak precisely.",
      minutes: 10,
      xp: 60,
      sections: [
        { kind: "prose", text: "A market order says: fill me now, at whatever the book offers. It guarantees execution, never price. A limit order says: fill me at my price or better, or not at all. It guarantees price, never execution. A stop order is a sleeping market order that wakes when price touches your trigger — it exists so a decision you made calmly can execute while you're not watching. Every structure on a professional desk — brackets, trailing stops, icebergs — is assembled from these three atoms." },
        { kind: "prose", text: "Amateurs use market orders out of impatience. Professionals use them deliberately, when the cost of missing the trade exceeds the cost of the spread. The reverse mistake is subtler: resting a limit order two percent below and feeling clever when it fills — into a waterfall that fills everyone's limits on its way down. A fill is not a win. A fill is the market agreeing with you about price, and the market agrees most eagerly right before it's about to be wrong." },
        { kind: "keyIdea", title: "Slippage is a tax on urgency", text: "Our simulator charges 5 basis points against you on market orders because real venues do worse in fast markets. If a strategy dies from 0.05% of friction, it was never alive." },
        { kind: "quiz", question: "NVDA trades at $207. You place a limit buy at $200. What are you actually saying?", choices: ["Buy immediately at $200", "Buy only if the market comes down to my price", "Sell if it hits $200", "Buy $200 worth"], answer: 1, explain: "A limit buy below market is patience with a price tag. You'll only own it if it gets cheaper — which is also the scenario where the market disagrees with you." },
        { kind: "desk", instruction: "Place a limit buy on any watchlist symbol 3% below the current price. Then go to Orders and look at it resting. Cancel it. You've now spoken all three words: place, rest, cancel.", symbol: "NVDA" },
      ],
    },
    {
      id: "f3-candles",
      title: "Candles are compressed arguments",
      hook: "One candle summarizes every trade in its window — learn to decompress it.",
      minutes: 9,
      xp: 60,
      sections: [
        { kind: "prose", text: "A candlestick stores four numbers: where price opened, the highest bid anyone paid, the lowest price anyone accepted, and where it closed. The body (open to close) is who won the argument. The wicks are the failed attempts — prices the market visited and rejected. A long lower wick on heavy volume means sellers pushed and buyers absorbed everything they sold. That rejection is information no single number carries." },
        { kind: "prose", text: "The trap is reading candles like tea leaves. A 'hammer' or 'doji' means nothing by itself; the same shape at a random spot is noise, and at a level where thousands of traders previously fought, it's evidence. Context multiplies meaning. This is why the next track is about structure — where the arguments happen matters more than the shape of any single one." },
        { kind: "keyIdea", title: "Wicks are rejections, bodies are decisions", text: "Read a candle as a sentence: 'we tried 330, rejected it, and settled at 327.' Ten of those in a row is a paragraph. A chart is an essay." },
        { kind: "quiz", question: "A daily candle opens at 100, trades up to 110, and closes at 101. What's the most honest reading?", choices: ["Bullish — price went up all day", "Bearish pressure — the move to 110 was rejected", "Neutral — it closed near open", "The data is broken"], answer: 1, explain: "Someone paid 110 and by the close the market wouldn't hold it. The 9-point upper wick is a failed argument for higher prices — worth respecting, not worshipping." },
        { kind: "desk", instruction: "Open any symbol on the 3M timeframe. Find the single biggest wick on the chart and ask: what happened there, and did price ever return to it?", symbol: "TSLA" },
      ],
    },
    {
      id: "f4-venues",
      title: "Sessions, venues, and why crypto never sleeps",
      hook: "The market you trade at 3am is not the market you trade at 10am — even for the same symbol.",
      minutes: 8,
      xp: 50,
      sections: [
        { kind: "prose", text: "US equities trade 9:30 to 4:00 Eastern in their deepest, most honest form. Before and after, liquidity thins: spreads widen, small orders move price absurdly, and the prints you see are more rumor than fact. Crypto never closes — which sounds like freedom until you realize it means there is no bell to protect you from yourself at 3am, and no daily settlement to reset everyone's leverage." },
        { kind: "prose", text: "This is why our terminal tells you 'US market closed — orders rest until the bell' instead of pretending. A stale quote presented as live is the smallest lie a platform can tell you, and small lies about data compound into large losses. A professional's first question about any price is: when, and how deep was the book that printed it?" },
        { kind: "keyIdea", title: "Liquidity has office hours", text: "The same 1,000-share order that vanishes into the 10am book can move an after-hours market half a percent. Size your expectations to the session." },
        { kind: "quiz", question: "Why does the terminal desaturate a quote and stamp it 'as of 6 hours ago'?", choices: ["A bug", "To look professional", "Because acting on stale data as if it were live is how accounts die", "Rate limits are embarrassing"], answer: 2, explain: "Data honesty is a safety feature. Every serious desk builds staleness indicators; most retail apps hide them." },
        { kind: "desk", instruction: "Compare BTC/USD (open 24/7) with SPY right now. One of them has a live argument happening; the other is showing you the last word of yesterday's. Which is which?", symbol: "BTC/USD" },
      ],
    },
  ],
};

export const priceTrack: Track = {
  id: "reading-price",
  title: "Reading Price",
  tagline: "Structure, levels, volume — the desk's native language",
  covers: "Applies to stocks, futures, crypto, everything with a chart",
  accent: "gain",
  lessons: [
    {
      id: "p1-trend-structure",
      title: "Trend is structure, not a feeling",
      hook: "Higher highs and higher lows — everything else is commentary.",
      minutes: 10,
      xp: 60,
      sections: [
        { kind: "prose", text: "An uptrend has a definition you can test: each rally exceeds the last (higher highs) and each pullback holds above the previous trough (higher lows). The moment a pullback undercuts the prior low, the definition breaks — not 'weakens,' breaks. Professionals draw these swing points because they're where the trend's definition gets falsified, and falsifiable claims are the only ones worth trading." },
        { kind: "prose", text: "The practical power is in what it forbids. If you can't point at the structure that would prove you wrong, you don't have a trade — you have a mood. 'I think NVDA goes up' is a mood. 'NVDA holds above 200 and I'm wrong below it' is a position with an exit built in before entry. Every risk lesson later in this academy stands on this idea." },
        { kind: "keyIdea", title: "Define wrong before you enter", text: "A trend trade is a bet that structure continues. The prior swing low is where that bet is objectively dead. Size from that distance — never from hope." },
        { kind: "quiz", question: "Price makes: low 90, high 110, pullback to 96, rally to 118, pullback to 93. What just happened?", choices: ["Uptrend intact", "The higher-low structure broke at 96 — 93 undercut it", "Nothing meaningful", "A double top"], answer: 1, explain: "The pullback to 93 broke below the prior higher low at 96. The uptrend's definition failed. It may recover — but the claim 'this is an uptrend' just lost its evidence." },
        { kind: "desk", instruction: "On any 3M chart, mark (mentally) the last three swing lows. Ask: at what price does this trend's definition break? That number is worth more than any forecast.", symbol: "SPY" },
      ],
    },
    {
      id: "p2-levels",
      title: "Levels are where arguments got settled",
      hook: "Price has memory because people have P&L.",
      minutes: 9,
      xp: 60,
      sections: [
        { kind: "prose", text: "Support and resistance aren't magic lines — they're inventory. When thousands of traders bought at 300 and price fell, those underwater positions wait. Return to 300 and a wave of them sell 'to get out even'; that supply is resistance, made of regret. Support is the mirror image: a level where buyers who missed the move promised themselves a second chance." },
        { kind: "prose", text: "This is why old resistance often becomes new support after a clean break: the people who sold at the level watch price run without them, and their regret becomes the new bid. Levels are more reliable when they're obvious — the more traders can see the line, the more real money is anchored to it. Draw fewer lines, at prices where something actually happened: big volume, violent rejection, gap origins." },
        { kind: "keyIdea", title: "Fewer, fatter lines", text: "A level is a zone, not a laser. Three lines you believe in beat thirty you decorate with. If nothing happened there, it's not a level — it's astrology." },
        { kind: "quiz", question: "A stock breaks above 250 resistance on huge volume, then pulls back to 250 and holds. What's the textbook reading?", choices: ["The breakout failed", "Old resistance acting as new support — the regretful sellers became buyers", "Coincidence", "Time to short"], answer: 1, explain: "The 250 sellers watched it leave without them; their bids now defend the level they used to sell. When that flip holds, the breakout has real inventory behind it." },
        { kind: "desk", instruction: "Find one price on your favorite symbol where the chart visited at least three times. Watch how it behaves there next time — you now have a hypothesis, not a hunch.", symbol: "AAPL" },
      ],
    },
    {
      id: "p3-volume",
      title: "Volume separates signal from theater",
      hook: "Price can lie for a while. Volume confesses.",
      minutes: 9,
      xp: 60,
      sections: [
        { kind: "prose", text: "Volume is the count of shares (or contracts, or coins) that actually changed hands. A breakout on triple average volume means real money repositioned; the same breakout on thin volume means a few traders pushed an empty book around, and empty-book moves retrace when the real players return. This is the first filter every professional applies and most amateurs skip." },
        { kind: "prose", text: "The subtler read is divergence. Price grinding to new highs while volume shrinks means fewer participants agree at each new price — the crowd thins near the top of the argument. It doesn't time the reversal (nothing does), but it tells you the trend is running on fewer engines. Combine with structure: a thin-volume high followed by a structure break is the market whispering, then saying it out loud." },
        { kind: "keyIdea", title: "Moves are only as real as their volume", text: "Ask of every big candle: who showed up? If the answer is 'almost nobody,' treat the move as a rumor about price, not a fact." },
        { kind: "quiz", question: "Two identical breakouts: one on 3x average volume, one on 0.4x. Which do professionals trust, and why?", choices: ["The 0.4x — stealth accumulation", "The 3x — real money participated at the new prices", "Both equally", "Neither, breakouts always fail"], answer: 1, explain: "High volume at new prices means large players accepted them. Thin volume means the prices haven't been tested by anyone who matters." },
        { kind: "desk", instruction: "Look at the volume bars under any chart. Find the single tallest one in the window and ask what the candle above it did — that day, the market meant it.", symbol: "NVDA" },
      ],
    },
    {
      id: "p4-timeframes",
      title: "Timeframes are jurisdictions",
      hook: "The 5-minute chart and the weekly chart are different courts — know which one your trade answers to.",
      minutes: 8,
      xp: 50,
      sections: [
        { kind: "prose", text: "Every timeframe has its own structure, levels, and trend — simultaneously, and often in disagreement. A stock can be in a daily uptrend, a weekly downtrend, and an hourly collapse at the same moment, and all three are true. Confusion between jurisdictions is one of the great account-killers: entering on a weekly signal, then panicking out on a 15-minute wiggle that was invisible at the timeframe that justified the trade." },
        { kind: "prose", text: "The professional discipline is simple: choose the timeframe that matches your holding period, look one level up for context, and one level down for entry precision — then stop looking down. If you plan to hold for weeks, the daily is your court, the weekly is the appellate court, and the 5-minute chart is street noise." },
        { kind: "keyIdea", title: "One level up for context, one down for timing", text: "Pick your home timeframe from your holding period. Consult its parent for the bigger trend. Never let a child timeframe overrule the court that authorized the trade." },
        { kind: "quiz", question: "You bought off a 3M daily structure with a plan to hold a month. Two hours later the 1D intraday view looks ugly. What now?", choices: ["Exit — the trade's failing", "Nothing — your trade's jurisdiction is the daily, and its structure is intact", "Double the position", "Switch to the 5Y view for comfort"], answer: 1, explain: "The trade answers to the timeframe that created it. Intraday noise can't falsify a daily thesis — only the daily structure breaking can." },
        { kind: "desk", instruction: "Flip one symbol through 1W → 3M → 1Y. Write one sentence per view describing the trend. If the sentences disagree, you've just met the reason most traders confuse themselves.", symbol: "TSLA" },
      ],
    },
  ],
};

export const riskTrack: Track = {
  id: "risk",
  title: "Risk — The Professional Edge",
  tagline: "The only chapter that decides whether you survive",
  covers: "The math that runs every real fund",
  accent: "loss",
  lessons: [
    {
      id: "r1-sizing",
      title: "Position sizing is the whole game",
      hook: "Entries are opinions. Size is destiny.",
      minutes: 11,
      xp: 80,
      sections: [
        { kind: "prose", text: "Here is the professional's secret, and it's disappointingly unsexy: they decide how much they can lose before deciding how much they can make. The fixed-fractional rule — risk a small constant fraction of your account per trade, classically 1% — isn't conservatism, it's arithmetic. Lose 1% ten times in a row (it happens to everyone) and you're down 9.6%, annoyed but alive. Risk 10% per trade through the same streak and you're down 65%, needing a 186% return just to get back to even." },
        { kind: "prose", text: "The mechanics: your risk per trade is entry price minus stop price, times shares. Rearranged, shares = (account × 1%) ÷ (entry − stop). Notice what this means — the distance to your stop sets your size. Wide stop, small position; tight stop, bigger position; same dollars at risk either way. Traders who size by feel are choosing a random number for the most important variable they control." },
        { kind: "formula", label: "Fixed-fractional sizing", expression: "shares = (equity × risk%) ÷ (entry − stop)", legend: "equity: account value · risk%: typically 0.5–2% · entry−stop: your defined 'wrong' distance from the Reading Price track" },
        { kind: "quiz", question: "Account $100,000, risking 1%. Entry $50, stop $46. How many shares?", choices: ["2,000", "250", "500", "1,000"], answer: 1, explain: "Risk budget = $1,000. Distance = $4. Shares = 1000 ÷ 4 = 250. If the stop is hit you lose exactly your budget — the loss was chosen, not suffered." },
        { kind: "desk", instruction: "Before your next simulated trade, compute this by hand: 1% of your equity, divided by your stop distance. Trade that size. Feel how boring it is. Boring is what compounding feels like from the inside.", symbol: "SPY" },
      ],
    },
    {
      id: "r2-expectancy",
      title: "Expectancy: why win rate is a vanity metric",
      hook: "A 30% win rate can print money. A 90% win rate can bankrupt you. Here's the only equation that knows the difference.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "Expectancy is what a strategy earns per trade, on average, after wins and losses wash out: (win rate × average win) − (loss rate × average loss). A system that wins 30% of the time but makes 4R on winners and loses 1R on losers earns 0.5R per trade — excellent. A system that wins 90% of the time collecting 0.5R, but loses 6R the other 10% (hello, option sellers who never learned this) bleeds −0.15R per trade. It feels great for months. Then one bad week deletes the year." },
        { kind: "prose", text: "This is why professionals talk in R-multiples — profit measured in units of initial risk — instead of dollars or percentages. R makes every trade comparable and makes the ledger honest: a +4R month with a 35% win rate is a good month, whatever the dopamine says. Track your own R distribution in the journal and you'll know more about your trading than any indicator can tell you." },
        { kind: "formula", label: "Expectancy", expression: "E = (Pwin × AvgWinR) − (Ploss × AvgLossR)", legend: "Measured in R (units of initial risk). Positive E with enough trades = an edge. Negative E = elaborate donation." },
        { kind: "quiz", question: "System A: 80% wins of +0.5R, losses −3R. System B: 35% wins of +3R, losses −1R. Which has the edge?", choices: ["A — 80% is amazing", "B — E(A) = −0.2R, E(B) = +0.4R", "They're equal", "Not enough information"], answer: 1, explain: "A: 0.8(0.5) − 0.2(3) = −0.2R per trade. B: 0.35(3) − 0.65(1) = +0.4R. The comfortable system loses; the uncomfortable one compounds. Most people can't emotionally trade B — that's why it keeps paying." },
        { kind: "desk", instruction: "Open your journal after your next five closed trades and compute your average win and loss in R. Five trades proves nothing statistically — but the habit of measuring is the entire point.", symbol: "AAPL" },
      ],
    },
    {
      id: "r3-drawdown",
      title: "Drawdown math is unforgiving — respect the asymmetry",
      hook: "Lose 50% and you need 100% to recover. The market doesn't do symmetry.",
      minutes: 9,
      xp: 70,
      sections: [
        { kind: "prose", text: "Every percentage loss requires a larger percentage gain to repair: −10% needs +11%, −25% needs +33%, −50% needs +100%, −90% needs +900%. This asymmetry is why capital preservation isn't a style preference — it's the mathematical precondition for compounding. The fund managers who survive decades aren't the ones with the highest peaks; they're the ones whose valleys stayed shallow." },
        { kind: "prose", text: "Drawdown also attacks the mind. At −20%, most traders don't calmly execute their system — they either freeze or swing for recovery, doubling size exactly when their judgment is worst. The professional answer is mechanical: define a maximum drawdown in advance (our agents halt automatically at theirs), reduce size as you approach it, and treat hitting it as a mandatory pause, not a dare. You'll notice the kill switch in the Agent Lab is a hold-to-confirm control. Yours should be too." },
        { kind: "formula", label: "Recovery required", expression: "recovery = drawdown ÷ (1 − drawdown)", legend: "−33% needs +50%. −50% needs +100%. The denominator is your remaining capital — the smaller it gets, the crueler the math." },
        { kind: "quiz", question: "Your $100k account drops to $60k. What return gets you back to even?", choices: ["40%", "50%", "66.7%", "60%"], answer: 2, explain: "You lost 40%, but recovery is measured on the $60k that remains: 40k/60k = 66.7%. This is why the 1% sizing rule from lesson one isn't optional." },
        { kind: "desk", instruction: "Check your equity curve on the portfolio view. Your current drawdown from peak is the only number on that screen that predicts whether you'll still be trading next year.", symbol: "SPY" },
      ],
    },
    {
      id: "r4-correlation",
      title: "Correlation: the risk you didn't know you tripled",
      hook: "Five positions can be one bet wearing five costumes.",
      minutes: 10,
      xp: 80,
      sections: [
        { kind: "prose", text: "Buy NVDA, AMD, MSFT, a semiconductor ETF, and BTC, and you don't have five positions — you have one position called 'risk appetite for tech' expressed five ways. When correlations converge (and in a selloff, they converge toward 1), your five careful 1% risks become a single 5% loss arriving in one afternoon. Diversification is not the count of your positions; it's the count of your independent bets." },
        { kind: "prose", text: "Real funds measure this with covariance matrices and factor models; a CFA studies it as Modern Portfolio Theory. You can capture most of the practical protection by asking a cruder question: 'if the market falls 3% tomorrow, which of my positions fall with it?' Everything that answers yes belongs to one budget. This is also the intuition behind hedging, which the futures track formalizes: a hedge is a position deliberately chosen to be negatively correlated with your book." },
        { kind: "keyIdea", title: "Count your bets, not your tickets", text: "Group positions by what makes them move. One theme = one risk budget, no matter how many symbols it wears." },
        { kind: "quiz", question: "You risk 1% each on NVDA, AMD, SMH (chip ETF), and a leveraged tech fund. A sector selloff hits. Your realistic exposure was:", choices: ["1% — each is sized properly", "~4% — the positions are one correlated bet", "0% — diversification protects you", "Impossible to say"], answer: 1, explain: "All four live inside the same argument (semiconductor demand and risk appetite). In stress, they move as one. Your careful per-trade sizing was defeated by portfolio-level blindness." },
        { kind: "desk", instruction: "Look at your open positions. Sort them by 'what argument is this really about?' If two share an answer, you've found hidden leverage — decide if you chose it on purpose.", symbol: "NVDA" },
      ],
    },
  ],
};

export const stocksTrack: Track = {
  id: "stocks-margin",
  title: "Stocks, Shorting & Margin",
  tagline: "Equities the way a long/short desk sees them",
  covers: "Stocks · margin · borrowing · the long/short book",
  accent: "gold",
  lessons: [
    {
      id: "s1-what-you-own",
      title: "What a share actually is (and why it has any price at all)",
      hook: "A stock is a claim on every dollar the business will ever earn — discounted by doubt.",
      minutes: 10,
      xp: 70,
      sections: [
        { kind: "prose", text: "A share is fractional ownership of a company's future cash flows. Its 'fair' price is the sum of everything the business will ever pay out, discounted back to today — discounted because money later is worth less than money now, and because the future might not cooperate. All of valuation is negotiation over two inputs: how big the future cash flows will be (growth) and how hard to discount them (rates and risk)." },
        { kind: "prose", text: "This is why interest rates move growth stocks so violently. A company promising most of its profits a decade from now is a long-duration asset: raise the discount rate and those distant dollars shrivel. It's also why 'the P/E is high' is not an argument by itself — a P/E is a compressed forecast, and the question is always whether the forecast inside the price is too optimistic or too grim. The market is rarely wrong about the present; it makes its living being wrong about the future." },
        { kind: "keyIdea", title: "Every price is a forecast", text: "You never trade a company; you trade the gap between the future the price implies and the future you believe. No gap, no trade." },
        { kind: "quiz", question: "Rates rise sharply. Why do unprofitable growth stocks usually fall harder than steady dividend payers?", choices: ["They're smaller companies", "Their value lives in distant cash flows, which higher discount rates punish most", "Dividend investors are smarter", "It's random"], answer: 1, explain: "Discounting hits far-future dollars hardest. A business earning real cash today has less of its value exposed to the discount rate's revenge." },
        { kind: "desk", instruction: "Pick a stock you like and ask: what future is today's price already assuming? If you can't answer, you're not disagreeing with the market — you're just visiting.", symbol: "AAPL" },
      ],
    },
    {
      id: "s2-shorting",
      title: "Shorting: selling what you don't own",
      hook: "Half of every hedge fund's name — 'long/short' — is this lesson.",
      minutes: 11,
      xp: 80,
      sections: [
        { kind: "prose", text: "To short a stock you borrow shares, sell them today, and hope to buy them back cheaper before returning them. Your profit is sale price minus repurchase price, minus borrow fees. The asymmetry deserves respect: a long position can lose at most 100%; a short can lose without limit, because there's no ceiling on price. Shorts also fight a structural headwind — equities drift upward over long horizons, and borrowed positions pay rent while they wait." },
        { kind: "prose", text: "So why do funds short at all? Three honest reasons: to profit from failure they've researched (frauds, fads, broken balance sheets), to hedge (short the sector, long the best company in it — isolating the relative bet), and to reduce market exposure so their stock-picking skill, not the market's mood, drives returns. That last one is the actual origin of the term 'hedge fund.' A short squeeze — forced buying by shorts whose losses grew unbearable — is what happens when crowded pessimism meets a rising price. The simulator will let you short when the margin update ships; the discipline it demands is this lesson's point." },
        { kind: "keyIdea", title: "Unlimited downside demands smaller size", text: "The sizing formula still rules, but a short's 'wrong' has no natural floor. Professionals short smaller, stop tighter, and never marry the position." },
        { kind: "quiz", question: "You short at $40. The company gets acquired at $90 overnight. Your loss per share is:", choices: ["$40 — capped like a long", "$50, and nothing capped it but the buyout price", "Zero — trades cancel on acquisitions", "$90"], answer: 1, explain: "You must buy back at $90 what you sold at $40. Overnight gaps skip right past stop orders — this is why short size must assume the gap, not the chart." },
        { kind: "desk", instruction: "Find a stock in your watchlist you believe is overpriced. Write the short thesis in your journal — WITHOUT the trade. If the thesis can't survive being written down, it couldn't have survived a squeeze either.", symbol: "TSLA" },
      ],
    },
    {
      id: "s3-margin",
      title: "Margin: renting conviction",
      hook: "Leverage doesn't change whether you're right. It changes whether you're around to find out.",
      minutes: 11,
      xp: 80,
      sections: [
        { kind: "prose", text: "Margin is borrowing against your portfolio to buy more of it. At 2:1 on $100k you control $200k: a 10% rally now pays 20% — and a 10% drop costs 20%, plus interest on the loan either way. The broker's protection is the maintenance requirement: if your equity (assets minus loan) falls below roughly 25% of the position's value, they demand more cash — the margin call — and if you can't post it, they liquidate you at whatever the market offers. The market's cruelest habit is offering the worst prices precisely then." },
        { kind: "prose", text: "The professional frame: leverage is a multiplier on your drawdown math from the Risk track, and drawdown math was already unforgiving at 1x. A 2x book turns a survivable −25% into a catastrophic −50%. Funds that live long lives use modest leverage on genuinely diversified books (counted in bets, not tickets) — never max leverage on one loud idea. When margin trading arrives on this desk, the simulator will margin-call you exactly like the street does. Better to meet that lesson here, where the money isn't real." },
        { kind: "formula", label: "Margin call trigger (2:1 initial, 25% maintenance)", expression: "call when equity ÷ position value < 25%", legend: "Buy $200k with $100k equity: a ~33% drop puts equity at $33k vs $133k position = call. Leverage moved your ruin point from −100% to −33%." },
        { kind: "quiz", question: "You buy $200k of stock with $100k cash at 2:1. The position falls 30%. Your equity is now:", choices: ["$70k — down 30%", "$40k — down 60%, and a margin call is knocking", "$100k — the loan absorbs it", "$140k"], answer: 1, explain: "Position: $140k. Loan: still $100k. Equity: $40k — a 60% loss on a 30% move, sitting at 28.6% maintenance with the call one red day away. Leverage doubled the move and moved the cliff closer." },
        { kind: "desk", instruction: "Recompute your position sizes as if you were 2:1 levered. Notice the sizes you'd need to HALVE to keep the same real risk. That halving is the entire secret of professional leverage.", symbol: "SPY" },
      ],
    },
    {
      id: "s4-catalysts",
      title: "Earnings, gaps, and trading the scheduled earthquake",
      hook: "Four times a year, every stock schedules its own volatility. Plan for it or be its liquidity.",
      minutes: 9,
      xp: 70,
      sections: [
        { kind: "prose", text: "Earnings reports are known-unknowns: the date is certain, the content isn't. Because everyone knows, the market pre-positions — implied volatility inflates, and the stock's opening gap after the report often dwarfs anything a stop order can protect you from. A stop at $95 means nothing when the stock opens at $82: stops are triggers, not guarantees, and gaps are where that distinction gets expensive." },
        { kind: "prose", text: "The professional approaches are all versions of respect: size the position assuming the gap (not the chart), hedge it with options that cap the downside (next track), or simply flatten before the print and re-enter after — surrendering the lottery ticket to keep the account. What amateurs call 'a stock reacting to earnings' is usually the reaction to the gap between results and the expectations already priced in. Great quarter, stock down 8%? The price had assumed an even greater one. The market grades on expectations, not absolutes." },
        { kind: "keyIdea", title: "Stops don't work through gaps", text: "Overnight risk is position size, full stop. If the worst gap you can imagine would wound the account, the position was too big before the market even opened." },
        { kind: "quiz", question: "A company beats earnings estimates by 10% and the stock falls 8%. The most likely reason:", choices: ["The market is irrational", "Expectations embedded in the price were higher than the reported beat", "Short sellers manipulated it", "Accounting fraud"], answer: 1, explain: "Prices carry forecasts. When the whisper number exceeds the official estimate, 'beating estimates' can still disappoint the price. You trade against expectations, not against headlines." },
        { kind: "desk", instruction: "Before any position's next earnings date, decide in writing: hold through with gap-sized position, hedge, or flatten. Deciding during the after-hours print is not deciding — it's flinching.", symbol: "NVDA" },
      ],
    },
  ],
};
