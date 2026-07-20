import SwiftUI

// MARK: - Curriculum content: Track 1 (Foundations) & Track 2 (Equities)
// Pure data — no views. Registered in Curriculum+Registry.swift.

extension Curriculum {

    // MARK: Track 1 — Foundations

    static let trackFoundations = Track(
        id: "foundations",
        title: "Foundations",
        tagline: "How markets actually work — before you touch a single order.",
        icon: "building.columns.fill",
        accent: TarsTheme.accent,
        audience: .beginner,
        lessons: [

            // 1 — What a market is
            Lesson(
                id: "foundations-1",
                title: "What a Market Is",
                minutes: 6,
                blocks: [
                    .heading("A crowd, arguing about price"),
                    .paragraph("Strip away the tickers and the terminals and a market is just a crowd of people who disagree. One side thinks a thing is worth more than its current price; the other thinks it's worth less. The price you see is not a fact about the thing — it's the exact spot where the argument is currently balanced."),
                    .paragraph("Every trade needs both sides. When you buy, a real counterparty sold to you, on purpose, at that price. They looked at the same information you did and reached the opposite conclusion. That should be humbling. It's supposed to be."),
                    .keyIdea("Price is not what something is worth. Price is where buyers and sellers last agreed to disagree."),
                    .paragraph("The mechanism that runs this argument is the order book: a standing list of what buyers will pay and what sellers will accept, sorted best-first. Trades happen where the two lists touch. Try it below — you're about to run a tiny market yourself."),
                    .widget(.orderBookSim),
                    .tarsAside("Every trade you ever make, someone takes the other side voluntarily. Consider, briefly, that they might not be an idiot."),
                    .paragraph("Notice what happened in the simulator: when you got aggressive, the price moved against you. That's not the market being mean — that's you consuming the available supply at each price level. Markets are honest that way. Impatience has a posted rate.")
                ],
                mission: nil
            ),

            // 2 — Reading a candle
            Lesson(
                id: "foundations-2",
                title: "Reading a Candle",
                minutes: 5,
                blocks: [
                    .heading("Four numbers in a costume"),
                    .paragraph("A candlestick looks mystical — wicks, bodies, colors — but it encodes exactly four numbers: the open, the high, the low, and the close for one slice of time. The body spans open to close. The wicks show how far price wandered before the crowd dragged it back."),
                    .paragraph("The story is in the shape. A tall body with tiny wicks means one side won decisively and never gave the ground back. Long wicks with a small body mean a brawl: price got pushed way out, and got pushed right back. Same four numbers, very different meeting."),
                    .widget(.candleAnatomy),
                    .keyIdea("A candle's body shows who won the period. Its wicks show how ugly the fight got along the way."),
                    .tarsAside("People have sold candlestick pattern courses for forty years. The candles are free. The four numbers are free. Draw your own conclusions about what's actually being sold."),
                    .paragraph("One honest caveat: a single candle is one sentence, not a story. A dramatic wick on a quiet Tuesday afternoon usually means nothing at all. Context — where price came from, and on how much volume — is what makes a candle worth reading. We'll get to volume in lesson five.")
                ],
                mission: nil
            ),

            // 3 — Order types
            Lesson(
                id: "foundations-3",
                title: "Order Types",
                minutes: 7,
                blocks: [
                    .heading("Speed or price. Pick one."),
                    .paragraph("Every order type is a different answer to the same question: what do you want guaranteed? A market order guarantees you trade right now, at whatever price the book offers when your order lands. A limit order guarantees your price — but the market is under no obligation to ever come get you."),
                    .paragraph("Then there are stops: orders that sleep until price crosses a line you drew, then wake up and act. A stop-loss is you, in a calm moment, leaving instructions for a future version of yourself who may be having a considerably worse day."),
                    .widget(.orderTypePlayground),
                    .keyIdea("Market orders buy certainty of execution. Limit orders buy certainty of price. You never get both — you only choose which uncertainty you can live with."),
                    .tarsAside("A market order says 'whatever it costs, do it now.' It works exactly the same way at a car dealership, with similar results."),
                    .paragraph("In a calm, liquid market the difference between them is pennies and this all feels academic. In a fast or thin market, it's the whole game. The traders who get hurt by slippage are almost always the ones who didn't know they'd chosen it.")
                ],
                mission: Mission(
                    id: "m-foundations-3",
                    title: "Place a limit order",
                    detail: "In the terminal, place a limit order on any symbol and let it fill. Set your price near the current quote if you'd like it filled this week.",
                    verify: .placeOrder(type: .limit)
                )
            ),

            // 4 — Bid, ask & the toll booth
            Lesson(
                id: "foundations-4",
                title: "Bid, Ask & the Toll Booth",
                minutes: 6,
                blocks: [
                    .heading("The price is actually two prices"),
                    .paragraph("There is no such thing as 'the' price. There's the bid — the best price anyone will pay you right now — and the ask, the best price anyone will sell to you for. The gap between them is the spread, and crossing it is the toll you pay for wanting a trade immediately."),
                    .paragraph("Here's the part beginners miss: the moment you buy at the ask, you own something you can only sell at the bid. You are instantly down the spread. Not because you were wrong — you haven't been right or wrong yet — but because immediacy is a service, and the toll booth collected."),
                    .keyIdea("Every round trip pays the spread. Trade a tight-spread stock and it's a rounding error. Trade often, or trade wide spreads, and the toll booth quietly becomes your largest opponent."),
                    .tarsAside("The spread is the only opponent that beats you on one hundred percent of your trades and never even had an opinion about the stock."),
                    .quiz(Quiz(
                        question: "A stock quotes bid $49.90 / ask $50.10. You buy at the ask and immediately sell. Ignoring fees, what happened?",
                        options: [
                            "Nothing — you bought and sold at the market price",
                            "You lost $0.20 per share, the spread",
                            "You made $0.20 per share by trading fast",
                            "It depends on which way the stock moved next"
                        ],
                        correctIndex: 1,
                        explanation: "You bought at $50.10 (the ask) and sold at $49.90 (the bid): a 20-cent loss per share with the price never moving at all. That's the spread — the cost of demanding immediacy in both directions. It's why 'the stock didn't move' and 'I didn't lose money' are different sentences, and why tight spreads are worth caring about before you care about anything else."
                    )),
                    .paragraph("Wide spreads cluster where liquidity is thin: tiny companies, odd hours, panicky moments. The market is quietly telling you that immediacy is expensive right now. Limit orders — lesson three — are how you decline to pay full toll.")
                ],
                mission: nil
            ),

            // 5 — Volume & conviction
            Lesson(
                id: "foundations-5",
                title: "Volume & Conviction",
                minutes: 6,
                blocks: [
                    .heading("How many people actually showed up"),
                    .paragraph("Price tells you what the crowd decided. Volume tells you how big the crowd was. A 5% rally on heavy volume means thousands of participants put real money behind that move. The same rally on a trickle of volume means a handful of trades pushed a sleepy book around — and sleepy books push back."),
                    .paragraph("This is why the same candle can mean opposite things. A breakout on huge volume has conviction behind it: lots of buyers committed at those new prices. A breakout on thin volume is a rumor with a chart. Both look identical if you hide the volume bars — which is an excellent reason never to hide the volume bars."),
                    .keyIdea("Volume is the market's turnout figure. Price moves on low volume are opinion polls; price moves on high volume are elections."),
                    .quiz(Quiz(
                        question: "A stock jumps 6% in an hour on volume far below its daily average. What's the most honest read?",
                        options: [
                            "Strong buying conviction — the move should continue",
                            "Few participants moved a thin market; the move is fragile until volume confirms it",
                            "Volume doesn't matter; only price matters",
                            "The stock is guaranteed to fall back"
                        ],
                        correctIndex: 1,
                        explanation: "Low volume means few people actually voted for that new price, so it rests on a thin base — a modest wave of selling can undo it just as fast. Note what the answer doesn't say: it doesn't say the move will reverse. 'Guaranteed to fall' is just the bullish error wearing a bearish coat. Volume tells you how much weight a move can bear, never which way the next one goes."
                    )),
                    .tarsAside("A price spike on no volume is three people getting very excited in an empty theater. Technically a standing ovation."),
                    .paragraph("A practical habit that costs nothing: whenever a move catches your eye, glance at the volume before you feel anything about it. Conviction moves and hollow moves need entirely different responses, and the volume bars will tell you which one you're looking at.")
                ],
                mission: nil
            ),

            // 6 — Your first trade, done right
            Lesson(
                id: "foundations-6",
                title: "Your First Trade, Done Right",
                minutes: 8,
                blocks: [
                    .heading("The trade is the last step, not the first"),
                    .paragraph("A trade done right starts before the order ticket. It starts with a thesis: a sentence stating what you believe, why you believe it, and what would prove you wrong. 'I think it goes up' is not a thesis. 'I think it goes up because of X, and if Y happens instead, I'm out' — that's a thesis. The difference is the exit."),
                    .paragraph("Write it down before you enter. Not after — before. A thesis written after the fill is a press release; your brain will quietly edit it to justify whatever you already did. Written first, it becomes the standard you grade yourself against, and it makes 'when do I sell?' a question you answered while you were still calm."),
                    .keyIdea("Entry, exit, and invalidation — decided before the order. If you can't say what would make you wrong, you don't have a thesis. You have a mood."),
                    .tarsAside("Everyone has a plan for the trade going well. The plan for it going badly is the one you'll actually need, which is naturally the one nobody writes."),
                    .paragraph("Then size it so the wrong outcome is boring. Your first trades are tuition — their job is to teach you how you behave with real positions on, not to make money. A position small enough that being wrong costs you a shrug is a position sized correctly for lesson one."),
                    .paragraph("This is paper trading, so the money is fake — but the habits are real, and they transfer. The mission below closes the loop: take a position, write the thesis, and when you close it, grade the reasoning rather than the P&L. Reasoning is the part you'll keep."),
                    .keyIdea("Judge every trade by the quality of the decision, not the outcome. Good decisions with bad outcomes are tuition. Bad decisions with good outcomes are a trap with a delay on it.")
                ],
                mission: Mission(
                    id: "m-foundations-6",
                    title: "Close a trade with a written thesis",
                    detail: "Open a position, write your thesis in the journal — what you believe, why, and what proves you wrong — then close the trade and grade the reasoning.",
                    verify: .journalThesis
                )
            )
        ]
    )

    // MARK: Track 2 — Equities

    static let trackEquities = Track(
        id: "equities",
        title: "Equities",
        tagline: "Stocks: what you actually own, and what you're actually paying.",
        icon: "chart.line.uptrend.xyaxis",
        accent: TarsTheme.gain,
        audience: .everyone,
        lessons: [

            // 1 — Market cap vs price
            Lesson(
                id: "equities-1",
                title: "Market Cap vs Price",
                minutes: 5,
                blocks: [
                    .heading("A $900 stock can be smaller than a $9 one"),
                    .paragraph("Share price alone tells you almost nothing, because companies get to choose how many slices to cut themselves into. A $900 stock with two million shares is a $1.8 billion company. A $9 stock with a billion shares is a $9 billion company — five times bigger, at one hundredth the sticker price."),
                    .paragraph("The number that matters is market capitalization: share price times share count. That's the crowd's current estimate of what the whole company is worth. When people say a stock 'looks cheap' because the price is a small number, they're reading the slice size, not the pizza."),
                    .keyIdea("Market cap = price × shares outstanding. Price tells you the size of one slice. Market cap tells you the size of the company."),
                    .tarsAside("A stock split cuts every share in half and doubles the count. People celebrate. It's the same pizza. Humans see a smaller number and feel richer — this is roughly half of finance."),
                    .quiz(Quiz(
                        question: "Company A trades at $500 with 10 million shares. Company B trades at $5 with 20 billion shares. Which is bigger?",
                        options: [
                            "Company A — $500 is a much bigger price",
                            "Company B — it's worth $100B to A's $5B",
                            "They're the same size",
                            "Can't tell without knowing profits"
                        ],
                        correctIndex: 1,
                        explanation: "Company B: $5 × 20 billion shares = $100 billion, against A's $500 × 10 million = $5 billion. B is twenty times larger despite a share price 100× smaller. This is the arithmetic behind why 'it's only $5, how much lower can it go?' has ruined so many afternoons — the answer is 100% lower, same as any other price. Always multiply before you form an opinion."
                    ))
                ],
                mission: nil
            ),

            // 2 — Valuation & P/E
            Lesson(
                id: "equities-2",
                title: "Valuation & the P/E Ratio",
                minutes: 7,
                blocks: [
                    .heading("What are you paying per dollar of profit?"),
                    .paragraph("The price-to-earnings ratio asks one blunt question: how many dollars are you paying for each dollar this company earns per year? A P/E of 20 means twenty dollars of price per dollar of annual profit. If earnings never changed, it would take twenty years of profits to earn back your price."),
                    .paragraph("But earnings do change, and that's the entire tension. A high P/E is the crowd saying 'earnings will grow into this price.' A low P/E is the crowd saying 'these earnings may shrink, or we're bored.' Neither number is a verdict — each is a forecast wearing a math costume, and forecasts are frequently wrong in both directions."),
                    .keyIdea("A P/E ratio isn't cheap or expensive on its own. It's a growth expectation. The question is never 'is 40 high?' — it's 'is the growth that 40 implies actually going to happen?'"),
                    .tarsAside("'It has a low P/E' and 'it's a bargain' are different sentences. Sometimes the market is mispricing a gem. Sometimes the market has read the same filings you have, plus a few you haven't."),
                    .quiz(Quiz(
                        question: "Stock X has a P/E of 8. Stock Y has a P/E of 45. What can you conclude?",
                        options: [
                            "X is the better buy — it's cheaper per dollar of earnings",
                            "Y is the better buy — high P/E means high quality",
                            "The market expects much more earnings growth from Y than X; which is 'right' depends on whether those expectations come true",
                            "Y is in a bubble"
                        ],
                        correctIndex: 2,
                        explanation: "A P/E gap is an expectations gap, not a quality ranking. If Y grows earnings 30% a year for a decade, 45 was cheap; if X's earnings are about to collapse, 8 was expensive — value traps are exactly low-P/E stocks whose E was a going-away party. Even if you picked an outcome answer, the reasoning is the takeaway: the ratio states the market's forecast. Your only edge is having a defensible reason the forecast is wrong."
                    )),
                    .paragraph("One more honest wrinkle: the E in P/E is an accounting figure, and accounting has opinions. One-time charges, buybacks, and creative adjustments all bend it. Treat any single ratio as one witness in a trial — useful testimony, but you'd want to hear from cash flow before convicting anyone.")
                ],
                mission: nil
            ),

            // 3 — Dividends
            Lesson(
                id: "equities-3",
                title: "Dividends",
                minutes: 6,
                blocks: [
                    .heading("The company mails you some of the profits"),
                    .paragraph("A dividend is a company handing shareholders a slice of its profits in cash, usually every quarter. It's the most literal form of 'owning a business' the stock market offers: the business made money, and some of it lands in your account without you selling a thing."),
                    .paragraph("The mechanics run on dates. Own the stock before the ex-dividend date and the payment is yours; buy on or after it and you've missed this round. And on the ex-date, the share price opens lower by roughly the dividend amount — the cash left the company, so the company is worth that much less. Watch it happen below."),
                    .widget(.dividendTimeline),
                    .keyIdea("A dividend isn't free money appearing — it's your money moving from the share price into your pocket. The value is in the stream over years, not the day it pays."),
                    .tarsAside("Every quarter, someone discovers you can buy a stock the day before the dividend and sell right after. Every quarter, the ex-date drop was waiting for them. The market closed that loophole before your grandparents were born."),
                    .paragraph("A last caution about big yields: dividend yield is payment divided by price, so a collapsing price makes the yield soar. A 12% yield is occasionally a generous company and frequently a falling one — the market pricing in that the payment won't survive. When a yield looks too good, check whether it's the dividend that's high or the confidence that's low.")
                ],
                mission: nil
            ),

            // 4 — ETFs vs stock picking
            Lesson(
                id: "equities-4",
                title: "ETFs vs Stock Picking",
                minutes: 7,
                blocks: [
                    .heading("Buy the haystack, or hunt the needle"),
                    .paragraph("An ETF is a single ticker that holds a whole basket of stocks — hundreds, sometimes thousands. One purchase and you own a sliver of all of them. Stock picking is the opposite bet: choosing individual companies because you believe you can spot the ones the crowd has mispriced."),
                    .paragraph("The uncomfortable data: over long periods, most professional stock pickers — full-time, well-paid, better-informed than you or me — fail to beat the broad index after fees. Not because they're foolish, but because the index's return is dominated by a few huge winners, and missing them is easy. That's the honest baseline any picking strategy has to argue against."),
                    .keyIdea("Diversification is the only free lunch in markets: it lowers risk without lowering expected return. Concentration isn't wrong — but it's a claim that you know something, and it should be held to that standard."),
                    .quiz(Quiz(
                        question: "You put everything into one stock. Your friend buys an ETF holding 500 stocks. A scandal cuts your company 60% overnight. What happened to each of you?",
                        options: [
                            "You're down 60%; your friend barely felt it",
                            "You're both down 60% — markets move together",
                            "The ETF is down more because it holds more stocks",
                            "Neither is affected until you sell"
                        ],
                        correctIndex: 0,
                        explanation: "You took the full 60%; your friend's exposure to that one company was a fraction of a percent of their basket. That asymmetry is the entire case for diversification — one company's disaster is capped at its tiny weight. The flip side is symmetric and worth saying out loud: if that stock had tripled instead, your friend barely feels that too. Diversification trades away the extremes in both directions. That's not a flaw; it's the product."
                    )),
                    .tarsAside("Everyone stock-picking believes they're above average. Statistically, the market is Lake Wobegon with brokerage fees."),
                    .paragraph("These aren't enemies, and this isn't advice on which to choose — plenty of sane people hold an index core and pick a few names on top with money they can afford to be wrong with. The mission below builds the habit either path needs: watching a broad set of companies before owning any of them.")
                ],
                mission: Mission(
                    id: "m-equities-4",
                    title: "Build a watchlist of 8",
                    detail: "Add at least 8 symbols to your watchlist. Mix sizes and industries — the point is to watch how differently they move before you own any of them.",
                    verify: .addWatchlist(count: 8)
                )
            ),

            // 5 — Earnings season
            Lesson(
                id: "equities-5",
                title: "Earnings Season",
                minutes: 6,
                blocks: [
                    .heading("Four report cards a year, graded in public"),
                    .paragraph("Four times a year, every public company opens its books: revenue, profit, and — often most market-moving — guidance about what it expects next. For a few weeks each quarter the market becomes a parade of these reports, and stocks that drifted quietly for months suddenly gap several percent overnight."),
                    .paragraph("Here's the piece that confuses everyone at first: stocks move on results relative to expectations, not results in isolation. A company can post record profits and drop 8%, because the market had already priced in even better. It can lose money and rally, because it lost less than feared. The report is graded against the forecast, not against zero."),
                    .keyIdea("By earnings day, expectations are already in the price. The stock doesn't react to the news — it reacts to the gap between the news and what was priced in."),
                    .tarsAside("'Great quarter, stock down 9%' reads like a market malfunction. It's actually the market saying 'we expected a greater quarter.' The market grades on a curve, and the curve is invisible."),
                    .quiz(Quiz(
                        question: "A company reports record revenue, up 25% year over year. The stock falls 7% the next morning. What's the most likely explanation?",
                        options: [
                            "The market made a mistake and it will correct",
                            "Expectations were even higher — the results or guidance fell short of what the price had assumed",
                            "Record revenue is bad for stocks",
                            "Someone leaked the report early"
                        ],
                        correctIndex: 1,
                        explanation: "The price going in already assumed something like 30%, or the forward guidance disappointed — either way, the gap between delivered and expected was negative, so the price adjusted down. Note the trap in option one: 'the market is wrong and will correct' is occasionally true but is also exactly what it feels like every time you're the one holding the stock. Earnings day is the clearest demonstration in markets that news doesn't move prices — surprise does."
                    )),
                    .paragraph("Practical corollary: holding a position through an earnings report is a bet on that expectations gap, which is a genuinely hard thing to predict — you're forecasting both the results and what's priced in. Knowing when your companies report is basic hygiene; treating those dates casually is how 'long-term investors' discover they were making event bets by accident.")
                ],
                mission: nil
            ),

            // 6 — Reading fundamentals
            Lesson(
                id: "equities-6",
                title: "Reading Fundamentals",
                minutes: 8,
                blocks: [
                    .heading("Three statements, one story"),
                    .paragraph("Every public company files three core statements. The income statement says what it earned over the period. The balance sheet says what it owns and owes at one moment. The cash flow statement says where actual money moved. Together they're the difference between owning a ticker and owning a business you could describe at dinner."),
                    .paragraph("If you only develop one instinct, make it this: profit is an opinion, cash is a fact. Earnings pass through layers of accounting judgment — timing, accruals, adjustments — while cash flow records money that actually arrived or left. A company reporting profits year after year while cash flows out the door is telling you two stories, and one of them isn't true."),
                    .keyIdea("Revenue is the top of the story, earnings are the middle, cash flow is the ending. Companies in trouble tend to fix the top of the story first. Endings are harder to edit."),
                    .paragraph("Debt is the other load-bearing wall. A company with heavy debt is a bet with borrowed money: brilliant in good times, brittle the moment revenue stumbles or refinancing gets expensive. Two companies with identical earnings and very different balance sheets are not remotely the same investment — one of them has a landlord."),
                    .tarsAside("An annual report is two hundred pages, and the interesting parts are rarely in the front. The front is what the company wants you to know. The footnotes are what it's required to tell you. Read accordingly."),
                    .keyIdea("You don't need to out-model Wall Street. You need to answer four questions in plain English: how does it make money, is that growing, does profit become cash, and who has to be paid back first."),
                    .paragraph("The mission closes this track where every real position should start: pick a company you're curious about and interrogate the fundamentals with Tars. Ask what the numbers mean, ask what could break the story, ask what you're missing. The habit of asking before buying is the entire lesson.")
                ],
                mission: Mission(
                    id: "m-equities-6",
                    title: "Interrogate a company with Tars",
                    detail: "Pick any company on your watchlist and ask Tars about its fundamentals — how it makes money, its debt, its cash flow. Ask at least one question you don't know the answer to.",
                    verify: .askTars
                )
            )
        ]
    )
}
