import SwiftUI

// MARK: - Tracks 5 & 6: Risk (everyone) and Funds (quant)
// Static curriculum content. Registered in Curriculum+Registry.swift.

extension Curriculum {

    // MARK: Track 5 — Risk. The most important track in the app.

    static let trackRisk = Track(
        id: "risk",
        title: "Risk",
        tagline: "The only edge you fully control",
        icon: "shield.lefthalf.filled",
        accent: TarsTheme.loss,
        audience: .everyone,
        lessons: [

            // 1 — Position sizing
            Lesson(
                id: "risk-sizing",
                title: "Position Sizing",
                minutes: 8,
                blocks: [
                    .heading("The question that comes before every trade"),
                    .paragraph("Most people start with \"what should I buy?\" The better first question is \"how much?\" Sizing decides how much a single wrong idea can hurt you — and every trader, without exception, has wrong ideas."),
                    .paragraph("A common framework is fixed-fraction sizing: risk a small, constant percentage of your account on any one trade. If your entry is $100 and your exit-if-wrong is $95, you're risking $5 per share. Divide your chosen account risk by that $5 and you have your share count. The math is unglamorous, which is a good sign — glamorous math is usually hiding something."),
                    .keyIdea("Position size is derived from your exit, not from your confidence. Confidence is not an input; it isn't measurable and it lies."),
                    .tarsAside("Humans size positions by feel. Feel is a random number generator with good marketing."),
                    .widget(.positionSizer),
                    .paragraph("Play with the sandbox above. Notice that the same idea, sized differently, produces completely different outcomes for the same sequence of wins and losses. The idea didn't change. The survival did."),
                    .paragraph("There are fancier methods — the Kelly criterion computes a theoretically optimal fraction from your win rate and payoff ratio. It also assumes you know those numbers precisely, which you don't. Practitioners who use Kelly at all tend to use a fraction of it. Treat it as a ceiling, not a target.")
                ],
                mission: nil
            ),

            // 2 — Drawdown math
            Lesson(
                id: "risk-drawdown",
                title: "Drawdown Math",
                minutes: 6,
                blocks: [
                    .heading("Losses are not symmetric"),
                    .paragraph("Lose 10% and you need about 11% to get back to even. Lose 25% and you need 33%. Lose 50% and you need 100% — a double, just to return to where you started. The hole gets deeper faster than it fills."),
                    .paragraph("This is arithmetic, not opinion. A drop from 100 to 50 is −50%. The trip from 50 back to 100 is +100%. Same distance on a price chart, very different distance in percentage terms — because the recovery is measured from the smaller base."),
                    .keyIdea("Recovery cost grows non-linearly. Small drawdowns are a fee; large drawdowns are a trap. Risk management exists to keep you out of the trap."),
                    .tarsAside("The market does not owe you your money back. It doesn't know it has it."),
                    .quiz(Quiz(
                        question: "Your account falls 40%. What gain do you now need just to break even?",
                        options: ["40%", "50%", "About 67%", "80%"],
                        correctIndex: 2,
                        explanation: "From 100 to 60 is −40%. Getting from 60 back to 100 requires 40 ÷ 60 ≈ 67%. The recovery is always measured from the smaller number — which is exactly why deep drawdowns are so expensive to escape."
                    )),
                    .paragraph("This asymmetry is the quiet argument behind every sizing rule you'll ever meet. Nobody caps their risk per trade because losing feels bad. They cap it because the math of getting back is brutal, and it gets more brutal the deeper you go.")
                ],
                mission: nil
            ),

            // 3 — Leverage
            Lesson(
                id: "risk-leverage",
                title: "Leverage",
                minutes: 7,
                blocks: [
                    .heading("Borrowed conviction"),
                    .paragraph("Leverage means controlling a position larger than your capital — borrowing money (margin) or using instruments that build the borrowing in (futures, options). It multiplies your exposure, which means it multiplies both outcomes with perfect indifference."),
                    .paragraph("At 2x leverage, a 10% move against you costs 20% of your equity. At 5x, that same ordinary 10% move costs half your account. And markets move 10% more often than people who are levered 5x tend to believe."),
                    .keyIdea("Leverage doesn't change whether you're right. It changes whether you're still around when you're eventually right."),
                    .widget(.leverageSimulator),
                    .paragraph("The simulator above lets you blow up an account with zero consequences — a service the real market does not offer. Notice the pattern: higher leverage doesn't just lose money faster, it turns survivable volatility into terminal events. A margin call closes your position at the worst possible moment, by design."),
                    .tarsAside("Blowing up a simulated account: educational. Blowing up a real one: also educational, but the tuition is higher and there are no retakes."),
                    .paragraph("None of this makes leverage evil. It's a tool with a steep cost curve. Professionals who use it size for the worst historical move plus room to spare — because the worst historical move was, at the time, unprecedented too.")
                ],
                mission: nil
            ),

            // 4 — Diversification's fine print
            Lesson(
                id: "risk-diversification",
                title: "Diversification's Fine Print",
                minutes: 7,
                blocks: [
                    .heading("The only free lunch, with conditions"),
                    .paragraph("Diversification is often called the only free lunch in finance: combine assets that don't move together and the portfolio's swings shrink without giving up the average return. The math is real. The fine print is the phrase \"don't move together.\""),
                    .paragraph("Correlation measures co-movement from −1 (opposites) to +1 (lockstep). Twenty tech stocks look like twenty positions, but if they share one fate — rates, chips, ad spend — you may effectively own one position, twenty times, with extra paperwork."),
                    .widget(.correlationMatrix),
                    .keyIdea("You are diversified across the risks your holdings don't share — not across the number of tickers you own."),
                    .paragraph("The nastier clause: correlations are not constants. In calm markets, assets wander independently. In a crisis, when everyone needs cash at once, correlations lurch toward +1 — precisely when you were counting on them not to. Diversification helps least at the moment you want it most. It still helps every other day, which is most days."),
                    .tarsAside("\"But I own fifteen different stocks.\" Fifteen boats, one tide.")
                ],
                mission: nil
            ),

            // 5 — Compounding
            Lesson(
                id: "risk-compounding",
                title: "Compounding",
                minutes: 6,
                blocks: [
                    .heading("Returns on returns"),
                    .paragraph("Compounding means each period's growth builds on everything before it. The curve starts insultingly flat and ends surprisingly steep — which is exactly why humans underrate it. We're wired for straight lines, and this isn't one."),
                    .widget(.compoundingCurve),
                    .paragraph("Drag the horizon in the visualizer and watch where the growth actually lives: the back half. This is why time in the market gets so much attention. Interrupting compounding — through deep drawdowns or long stretches on the sidelines — costs the most expensive years, the late ones."),
                    .keyIdea("Compounding rewards two things above all: not stopping and not blowing up. Both are risk-management outcomes before they are return outcomes."),
                    .tarsAside("The eighth wonder of the world, allegedly. The first seven didn't require you to sit still for twenty years, so this one stays underrated."),
                    .paragraph("One caution: compounding works on losses too. Fees, borrowing costs, and repeated small mistakes compound with the same patience as gains. The curve doesn't care which direction it's bending.")
                ],
                mission: nil
            ),

            // 6 — Psychology
            Lesson(
                id: "risk-psychology",
                title: "Psychology: Why Most Traders Lose",
                minutes: 9,
                blocks: [
                    .heading("The uncomfortable base rate"),
                    .paragraph("Study after study across brokerages and countries finds the same shape: most short-term retail traders underperform the market, and a large share lose money outright. Not because they're unintelligent — because they're human, and the market is exquisitely tuned to punish human defaults."),
                    .paragraph("The defaults have names. Loss aversion: losses hurt roughly twice as much as equal gains feel good, so you hold losers hoping and sell winners early. Overconfidence: most people rate themselves above-average drivers, and above-average traders. Recency bias: whatever just happened feels like what happens. Confirmation bias: you search for evidence you're right, and the internet always has some in stock."),
                    .keyIdea("You cannot delete these biases — they ship with the hardware. You can only build rules that fire before the bias does. That's what process is: a decision made by the calm version of you, enforced on the excited one."),
                    .tarsAside("My honesty setting is at 90%, so: I have none of these biases, and you have all of them. That's not an insult. It's the one asymmetry in this app that's actually reliable."),
                    .quiz(Quiz(
                        question: "A stock you own drops 20% below your planned exit. The most commonly documented retail behavior is to:",
                        options: [
                            "Sell immediately as planned",
                            "Hold on, because selling would make the loss feel real",
                            "Buy more to lower the average, per a written plan",
                            "Hedge the position with options"
                        ],
                        correctIndex: 1,
                        explanation: "The disposition effect is one of the most replicated findings in behavioral finance: traders hold losers too long and sell winners too early, because realizing a loss hurts more than the equivalent paper loss. Knowing the name doesn't cure it. Exits decided in advance — and honored — are the working treatment."
                    )),
                    .paragraph("There's no shame in any of this. The shame-free framing is the useful one: the traders who last aren't the ones without emotions, they're the ones who stopped letting emotions hold the order button."),
                    .paragraph("This is also, honestly, the best argument for the paper account you're using right now. Every bias you'll meet with real money shows up here first — at a steep discount.")
                ],
                mission: nil
            ),

            // 7 — Your risk rules
            Lesson(
                id: "risk-rules",
                title: "Your Risk Rules",
                minutes: 5,
                blocks: [
                    .heading("Write the rules before the game"),
                    .paragraph("Everything in this track condenses to a short personal document: how much you risk per trade, where your exit is before you enter, what leverage you'll touch (if any), and what you own too much of. It fits on an index card. Its value is that you wrote it while calm."),
                    .paragraph("The mechanical version of a pre-decided exit is a bracket order: entry, profit target, and stop loss submitted together. The stop isn't a prediction that you're wrong — it's an admission, filed in advance, that you might be. Filing it in advance is the entire trick, because the version of you watching a losing position is not a reliable narrator."),
                    .keyIdea("A risk rule you can override in the moment is a suggestion. Brackets turn suggestions into structure."),
                    .tarsAside("Your risk rules are the one conversation where you should outrank future-you. Future-you will be emotional and outnumbered."),
                    .paragraph("Your mission: put one on the wire. Any symbol, small size — the point is the mechanism, not the trade.")
                ],
                mission: Mission(
                    id: "risk-mission-bracket",
                    title: "File your exit in advance",
                    detail: "Place a bracket order in the paper terminal — entry with an attached profit target and stop loss. Size it small; this is about building the reflex, not the P&L.",
                    verify: .useBracket
                )
            )
        ]
    )

    // MARK: Track 6 — Funds. How the professionals are structured.

    static let trackFunds = Track(
        id: "funds",
        title: "Funds",
        tagline: "How professional money actually operates",
        icon: "building.2.fill",
        accent: TarsTheme.accent,
        audience: .quant,
        lessons: [

            // 1 — What a hedge fund actually is
            Lesson(
                id: "funds-what",
                title: "What a Hedge Fund Actually Is",
                minutes: 7,
                blocks: [
                    .heading("Less glamorous than the movies"),
                    .paragraph("Strip away the mythology and a hedge fund is a private investment partnership: a pool of money from institutions and wealthy individuals, run by a management company, with far fewer constraints than a mutual fund. It can short, use leverage, trade derivatives, and concentrate — tools regulators keep away from retail funds."),
                    .paragraph("The name is a fossil. The original 1949 fund \"hedged\" by pairing long positions with shorts, aiming to profit from stock picking while cancelling out the market's overall swings. Plenty of modern \"hedge funds\" barely hedge at all; the term now mostly means \"lightly constrained private fund.\""),
                    .keyIdea("The defining feature isn't secrecy or genius — it's flexibility. The fund can express views (short, levered, concentrated) that regulated retail products cannot."),
                    .tarsAside("A hedge fund is a mutual fund that took its seatbelt off and charges you for the privilege of watching."),
                    .quiz(Quiz(
                        question: "What actually distinguishes a hedge fund from a typical mutual fund?",
                        options: [
                            "Hedge funds are guaranteed to beat the market",
                            "Hedge funds always hedge out all risk",
                            "Fewer regulatory constraints: shorting, leverage, and concentration are allowed",
                            "Hedge funds are open to anyone with a brokerage account"
                        ],
                        correctIndex: 2,
                        explanation: "No fund is guaranteed anything, many hedge funds hedge very little, and access is restricted to accredited or institutional investors. The real distinction is structural freedom — the toolkit, not the results."
                    ))
                ],
                mission: nil
            ),

            // 2 — Long/short & market-neutral
            Lesson(
                id: "funds-longshort",
                title: "Long/Short & Market-Neutral",
                minutes: 7,
                blocks: [
                    .heading("Owning the difference"),
                    .paragraph("A long/short equity fund buys stocks it expects to do well and shorts stocks it expects to do poorly. The portfolio's fate now depends less on where the market goes and more on whether the longs beat the shorts — the spread between them."),
                    .paragraph("Push that to its logical end and you get market-neutral: long and short exposures balanced so the market's overall direction roughly cancels out. A market-neutral book can, in principle, make money in a crash and lose money in a rally. It has traded away market risk for a purer bet on selection skill."),
                    .keyIdea("Long/short converts \"will stocks go up?\" into \"which stocks are mispriced relative to each other?\" — a different question, and arguably a harder one, but one where research can matter more than mood."),
                    .paragraph("The catch is that neutral-on-paper is not neutral-in-practice. Shorts have borrow costs, can be recalled at bad moments, and have unbounded loss if the stock rips. And a book that's market-neutral can still be secretly long one factor — crowded growth names against sleepy value names, say — which is how \"neutral\" funds sometimes all stumble in the same week."),
                    .tarsAside("Market-neutral means neutral to the market. It does not mean neutral to being wrong.")
                ],
                mission: nil
            ),

            // 3 — Quant strategies & their decay
            Lesson(
                id: "funds-quant",
                title: "Quant Strategies & Their Decay",
                minutes: 8,
                blocks: [
                    .heading("Edges with half-lives"),
                    .paragraph("Quantitative funds trade rules, not stories: patterns mined from data, tested on history, executed by machines. The classic families have names — momentum (what's been rising keeps rising, for a while), mean reversion (what's stretched snaps back, usually), value, carry, trend. Each has decades of evidence. None has a warranty."),
                    .paragraph("Here's the part the backtest never shows: strategies decay. A genuine inefficiency attracts capital the moment it's discovered, and the capital that arrives to harvest it is the same force that shrinks it. Publish an anomaly in a journal and its measured returns tend to fade afterward. The market is an ecosystem that eats its own edges."),
                    .keyIdea("Every backtest is a photograph of a market that no longer exists. The question is never \"did this work?\" — it's \"why would this keep working now that others can see it too?\""),
                    .paragraph("Decay is also why quant shops run portfolios of many small edges rather than one big one, retire signals without sentiment, and obsess over transaction costs — when your edge is a fraction of a percent, the cost of trading it can be the difference between a strategy and a donation."),
                    .tarsAside("A backtest is the one place in finance where everyone is a genius. The returns are real; they just belong to the past, which has stopped accepting new investors.")
                ],
                mission: nil
            ),

            // 4 — Fees: "2 and 20"
            Lesson(
                id: "funds-fees",
                title: "Fees: \"2 and 20\"",
                minutes: 6,
                blocks: [
                    .heading("The house percentage"),
                    .paragraph("The traditional hedge fund fee is \"2 and 20\": a 2% annual management fee on assets, plus 20% of the profits. The management fee arrives whether or not the fund makes money. The performance fee is the fund's cut of the upside — with no matching share of the downside."),
                    .paragraph("Two structures soften the deal for investors. A high-water mark means the fund only takes performance fees on gains above its previous peak — it can't charge you twice for recovering your own money. A hurdle rate means performance fees apply only to returns above some benchmark. Both are negotiated, not guaranteed, and average fees across the industry have drifted below the classic 2-and-20 as competition bit."),
                    .quiz(Quiz(
                        question: "A fund charging 2-and-20 returns 10% gross on your $100. Ignoring hurdles, roughly what do you keep?",
                        options: ["The full $10", "About $8", "About $6", "About $4"],
                        correctIndex: 2,
                        explanation: "Management fee: 2% of $100 = $2. Performance fee: 20% of the $10 gain = $2 (real funds net these in a particular order, but this is the shape). You keep roughly $6 of $10 — the fund kept about 40% of your gross return in a good year. Now imagine the compounding lesson from the Risk track applied to that drag, every year."
                    )),
                    .keyIdea("Fees compound with the same patience as returns. A fund must out-earn its own fee stack, every year, before you break even against a cheap index — some do; the arithmetic of how many can is unforgiving."),
                    .tarsAside("\"2 and 20\" — 2% for showing up, 20% for good luck. The asymmetry is not on your side of the table.")
                ],
                mission: nil
            ),

            // 5 — Thinking like an allocator
            Lesson(
                id: "funds-allocator",
                title: "Thinking Like an Allocator",
                minutes: 7,
                blocks: [
                    .heading("The people who hire the funds"),
                    .paragraph("Allocators — pensions, endowments, family offices — are the customers of the fund world. Their job is not picking stocks; it's picking pickers. Watching how they evaluate funds is a masterclass in evaluating any strategy, including your own."),
                    .paragraph("Allocators are professionally suspicious of raw returns. They ask what risk produced the return (risk-adjusted metrics like the Sharpe ratio), whether the return came from skill or from broadly available exposures they could buy cheaply elsewhere (alpha vs. beta), how bad the worst stretch was (maximum drawdown), and — hardest of all — whether the track record is skill or survivorship. Enough coin-flippers in a tournament and someone flips ten heads."),
                    .keyIdea("Allocators grade process, not outcomes. A great year from a bad process is a warning sign wearing a party hat."),
                    .quiz(Quiz(
                        question: "Two funds both returned 12% last year. Fund A had a max drawdown of 4%; Fund B, 35%. An allocator most likely concludes:",
                        options: [
                            "The funds are equivalent — same return",
                            "Fund B is better; it clearly takes bold positions",
                            "Fund A likely delivered the return with far less risk, so the same result required less luck",
                            "Neither number matters without this month's returns"
                        ],
                        correctIndex: 2,
                        explanation: "Identical returns from wildly different risk are not identical results. Fund B's path implies it could plausibly have delivered −35% instead; its 12% leaned harder on fortune. Return per unit of risk — not return — is the allocator's native language, and it's a useful language for judging your own paper trading too."
                    )),
                    .tarsAside("Judge your own account like a skeptical stranger with a spreadsheet is deciding whether to fund you. Because in a sense, one is — it's just that the stranger is you, and the money already left.")
                ],
                mission: nil
            ),

            // 6 — Your paper fund
            Lesson(
                id: "funds-paperfund",
                title: "Your Paper Fund",
                minutes: 5,
                blocks: [
                    .heading("Run the thing you've been studying"),
                    .paragraph("You now know the anatomy: a mandate (what you trade and why), a risk framework (the Risk track — your fee for skipping it is unbounded), and a process someone skeptical could audit. That's a fund, minus the lawyers and the fees. Your paper account can be one, at a scale where tuition is free."),
                    .paragraph("Start like a fund starts: more than one position, so you're managing a portfolio rather than nursing a single bet. Two holdings is the minimum honest portfolio — it forces the questions single positions never ask. Do these two share a risk? Which deserves more capital? What would make you cut one?"),
                    .keyIdea("A portfolio is a set of arguments held simultaneously. Running one — even two positions on paper — teaches allocation, correlation, and sizing in a way no single trade can."),
                    .paragraph("And when you're ready to go full quant: the Agent Lab is where this track stops being reading. There you'll design rule-based strategies, backtest them, and watch them decay in miniature — the entire hedge fund lifecycle, compressed, with none of your money at stake. This lesson's mission is the bridge; hold up your end."),
                    .tarsAside("Congratulations on founding a fund with zero dollars under management. Every fund's assets are imaginary until someone believes in the process. Yours is just honest about it — go build the process.")
                ],
                mission: Mission(
                    id: "funds-mission-portfolio",
                    title: "Open the doors",
                    detail: "Hold at least 2 positions simultaneously in your paper account. You're no longer making trades — you're allocating a book. Notice how differently that feels.",
                    verify: .holdPositions(count: 2)
                )
            )
        ]
    )
}
