import SwiftUI

// MARK: - Tracks 3 & 4: Options, and The Wider World (macro)
// Registered in Curriculum+Registry.swift. Content only — no views here.

extension Curriculum {

    // MARK: Track 3 — Options

    static let trackOptions = Track(
        id: "options",
        title: "Options, Decoded",
        tagline: "Convexity, insurance, and why time is always billing you.",
        icon: "point.topleft.down.curvedto.point.bottomright.up",
        accent: TarsTheme.agentPurple,
        audience: .trader,
        lessons: [

            // 1 — Calls
            Lesson(
                id: "opt-calls",
                title: "Calls: Renting the Upside",
                minutes: 8,
                blocks: [
                    .heading("A call is a maybe, with a deadline"),
                    .paragraph("A call option gives you the right — not the obligation — to buy 100 shares at a fixed price (the strike) before a fixed date (expiration). You pay a premium up front for that right. If the stock never gets above the strike, the right is worthless and the premium is gone."),
                    .paragraph("That asymmetry is the whole product. Your loss is capped at the premium. Your upside, in theory, isn't capped at all. Sounds great until you notice who designed the pricing: people who understood that asymmetry better than you do."),
                    .keyIdea("Buying a call caps your loss at the premium and leaves the upside open. The price you pay for that shape is the premium itself — and it is not a rounding error."),
                    .widget(.payoffBuilder),
                    .paragraph("Drag the strike and expiry in the builder above. Notice the hockey-stick shape: flat loss at the premium below the strike, rising payoff above it. The kink at the strike is where 'maybe' becomes 'yes'."),
                    .paragraph("Breakeven is not the strike. It's the strike plus what you paid. A stock can finish above your strike and you can still lose money. This surprises more people than it should."),
                    .tarsAside("The payoff diagram is honest in a way brokers' marketing is not. Flat line: that's you, most of the time.")
                ]
            ),

            // 2 — Puts & insurance
            Lesson(
                id: "opt-puts",
                title: "Puts: Insurance You Can Trade",
                minutes: 8,
                blocks: [
                    .heading("The right to sell"),
                    .paragraph("A put is the mirror image of a call: the right to sell 100 shares at the strike before expiration. If the stock craters, your put becomes valuable. If it doesn't, the premium evaporates."),
                    .paragraph("The cleanest way to think about a put is as insurance. You own a house; you buy fire insurance; most years, the house doesn't burn and the premium was 'wasted'. That's not failure — that's insurance working as designed. A protective put on a stock you own works the same way."),
                    .keyIdea("Insurance that never pays out isn't broken. Most puts expire worthless — and for hedgers, that is the good outcome, because it means the portfolio didn't burn down."),
                    .paragraph("The trouble starts when people buy puts not as insurance but as lottery tickets on a crash. Crashes are rare, put premiums price that in, and the bleed between crashes is relentless."),
                    .tarsAside("Everyone wants to have owned puts during the crash. Almost nobody enjoys owning them during the other 95% of history."),
                    .quiz(Quiz(
                        question: "You own 100 shares of a stock at $50 and buy a $45-strike put for $2. The stock falls to $30 at expiration. Roughly what happened to your total position?",
                        options: [
                            "You lost the full $20 per share, plus the premium",
                            "Your loss stopped near $5 per share, plus the $2 premium",
                            "You made money — puts profit when stocks fall",
                            "The put expired worthless because the stock moved too fast"
                        ],
                        correctIndex: 1,
                        explanation: "The put lets you sell at $45 no matter how low the stock goes, so the share loss is capped at $5 ($50 → $45). Add the $2 premium and the total damage is about $7 per share instead of $20. The put itself gained value, but on a hedged position its job was to cap the loss — which it did."
                    ))
                ]
            ),

            // 3 — Premium & the Greeks
            Lesson(
                id: "opt-greeks",
                title: "Premium and the Greeks",
                minutes: 10,
                blocks: [
                    .heading("What you're actually paying for"),
                    .paragraph("An option's premium has two parts. Intrinsic value is what the option would be worth if exercised right now. Everything else is extrinsic value — a price on time and uncertainty. Out-of-the-money options are 100% extrinsic: pure possibility, priced by the hour."),
                    .paragraph("The Greeks are just sensitivities — how the premium reacts when one input moves. Delta: how much the option moves per $1 of stock move. Gamma: how fast delta itself changes. Theta: how much value leaks away per day. Vega: how much the price moves when implied volatility shifts."),
                    .widget(.greeksLab),
                    .paragraph("Play with the lab above. Watch delta climb toward 1 as the option goes deep in the money, and watch theta get vicious in the final weeks. These aren't abstractions — they're the levers your P&L actually hangs from."),
                    .keyIdea("You can be right about direction and still lose. If the move comes too slowly (theta) or volatility was overpriced when you bought (vega), the Greeks eat the win before you collect it."),
                    .tarsAside("People memorize the Greeks like vocabulary words. The market grades it as a lab practical, with your money as the lab fee.")
                ]
            ),

            // 4 — Theta is rent
            Lesson(
                id: "opt-theta",
                title: "Theta Is Rent",
                minutes: 7,
                blocks: [
                    .heading("The meter is always running"),
                    .paragraph("Every day you hold a long option, a slice of its extrinsic value disappears. That's theta. It isn't a fee anyone charges you — it's the mathematical consequence of a deadline getting closer. Fewer days left means fewer chances for the big move, so the 'maybe' is worth less."),
                    .paragraph("Decay is not linear. An at-the-money option loses value slowly with 90 days left and rapidly with 9. The last few weeks before expiration are where premium goes to die."),
                    .keyIdea("Option buyers pay rent daily; option sellers collect it. Over many trades, most bought options expire worth less than what was paid. That's not a scandal — it's the insurance business, seen from the customer's side of the counter."),
                    .paragraph("This is the honest core of options: buyers, in aggregate, bleed theta. The occasional large win is real, but it has to outrun a steady daily leak. Anyone selling you a strategy that ignores the leak is selling the sizzle, not the steak."),
                    .tarsAside("Theta is the only Greek that shows up every single day, weekends included, whether your thesis does or not. Respect the landlord."),
                    .quiz(Quiz(
                        question: "You buy an at-the-money call with 45 days to expiration. The stock goes exactly nowhere for three weeks. What has happened to your option?",
                        options: [
                            "Nothing — the stock is flat, so the option is flat",
                            "It gained value, because it's three weeks closer to a possible move",
                            "It lost a meaningful chunk of value to time decay",
                            "It converted to shares automatically"
                        ],
                        correctIndex: 2,
                        explanation: "Flat stock, shrinking clock. With no intrinsic value and 21 fewer days of possibility, the extrinsic value has decayed — and decay accelerates as expiration approaches. 'The stock didn't move' is a loss for an option buyer, not a tie."
                    ))
                ]
            ),

            // 5 — Vertical spreads
            Lesson(
                id: "opt-spreads",
                title: "Spreads: Capping Both Ends",
                minutes: 10,
                blocks: [
                    .heading("Buy one, sell another"),
                    .paragraph("A vertical spread pairs a bought option with a sold one at a different strike, same expiration. Buy the $100 call, sell the $110 call: you've paid less premium than the naked call, and in exchange you've capped your maximum profit at the distance between strikes."),
                    .paragraph("Why cap your upside on purpose? Because the sold option's premium offsets your theta bill. You've stopped renting the whole building and sublet a floor. The trade-off is explicit: defined risk, defined reward, both visible before you enter."),
                    .widget(.payoffBuilder),
                    .paragraph("Build a vertical above — one long leg, one short leg. Notice how the payoff becomes a step: flat, ramp, flat. Both your best case and worst case are now numbers you can read off the chart, not hopes."),
                    .keyIdea("Spreads trade unlimited upside for a lower cost and a smaller theta leak. You know your maximum loss and maximum gain at entry — which is more than most naked-option buyers can say."),
                    .tarsAside("Defined risk is unfashionable because it caps the daydream. It also caps the disaster. Pick which one you'd rather live with."),
                    .quiz(Quiz(
                        question: "You buy a $100/$110 call vertical for a $3.00 net debit. What is your maximum possible profit at expiration?",
                        options: [
                            "Unlimited — it's a call",
                            "$10.00 per share",
                            "$7.00 per share",
                            "$3.00 per share"
                        ],
                        correctIndex: 2,
                        explanation: "The spread's maximum value is the distance between strikes: $10. You paid $3 for it, so the best case is $10 − $3 = $7 per share (times 100 per contract). The short $110 call surrenders everything above $110 — that's the deal you made for the cheaper entry."
                    ))
                ]
            ),

            // 6 — Straddles & condors
            Lesson(
                id: "opt-straddles",
                title: "Straddles and Condors: Trading the Wiggle",
                minutes: 9,
                blocks: [
                    .heading("Betting on motion itself"),
                    .paragraph("Some structures don't care which way the stock goes — only how far. A straddle buys both a call and a put at the same strike: you profit if the stock moves a lot in either direction, and you bleed double theta if it doesn't."),
                    .paragraph("An iron condor is the opposite wager: sell a put spread below the market and a call spread above it, collecting premium for betting the stock stays inside a range. Small, frequent wins; occasional larger losses when the stock escapes the range."),
                    .widget(.payoffBuilder),
                    .paragraph("Build both above. The straddle is a V — expensive at the point, profitable at the wings. The condor is a plateau with cliffs. Every options structure is just legs stacked until the payoff shape matches your actual opinion."),
                    .keyIdea("Straddles buy volatility; condors sell it. Neither is 'the good one'. The straddle needs the move to be bigger than what was priced in; the condor needs it smaller. Either way, you're arguing with the market's volatility estimate — and the market has seen a lot of arguments."),
                    .tarsAside("A straddle before earnings feels brilliant. Then the stock moves 4% when the options priced 6%, both legs deflate, and you've discovered that 'I knew it would move' was already in the premium.")
                ]
            ),

            // 7 — Assignment & IV
            Lesson(
                id: "opt-assignment",
                title: "Assignment and the IV Trap",
                minutes: 9,
                blocks: [
                    .heading("The fine print, out loud"),
                    .paragraph("If you sell an option, the buyer can exercise it — and when they do, you're assigned. Assigned on a short call, you must deliver 100 shares at the strike; on a short put, you must buy them. American-style options can be exercised any time before expiration, most commonly right before a dividend or deep in the money."),
                    .paragraph("Then there's implied volatility. IV is the market's priced-in guess about future movement, and it's a component of every premium you pay. When an anticipated event passes — earnings, a ruling, a launch — IV collapses. This is 'IV crush': the option can lose value even when the stock moves your way, because the uncertainty you paid for just got resolved."),
                    .keyIdea("Two ways to be right and still lose: get assigned at an awkward moment on a short leg, or buy high-IV options into an event and watch the premium deflate the instant the news lands. The market charges for suspense, then stops charging when the suspense ends."),
                    .paragraph("None of this makes options bad. It makes them precise instruments with sharp edges. The people who do well with them tend to know the payoff shape, the theta bill, and the IV context of every position before entry — not after."),
                    .tarsAside("Earnings-week option buyers pay a suspense surcharge, watch the movie, and are then surprised the ticket wasn't refundable."),
                    .quiz(Quiz(
                        question: "A stock closes earnings night up 5% — a solid move. Your call, bought the day before, opens lower the next morning. What most likely happened?",
                        options: [
                            "The broker mispriced your option",
                            "Implied volatility collapsed after the event, deflating the premium more than the move inflated it",
                            "Theta doubled overnight",
                            "You were assigned early"
                        ],
                        correctIndex: 1,
                        explanation: "IV crush. Before earnings the option priced in a big potential move; a 5% move was apparently less than the priced-in suspense. Uncertainty resolved, vega gave back more than delta earned. You were right about direction and still lost — a rite of passage in options, best done once and in paper."
                    ))
                ],
                mission: Mission(
                    id: "opt-mission-ask",
                    title: "Interrogate the machine",
                    detail: "Ask Tars to walk through the payoff of any options structure you're curious about. Free questions are the cheapest edge in this business.",
                    verify: .askTars
                )
            )
        ]
    )

    // MARK: Track 4 — Macro & other markets

    static let trackMacro = Track(
        id: "macro",
        title: "The Wider World",
        tagline: "Crypto, futures, FX, bonds, commodities — and the plumbing that connects them.",
        icon: "globe.americas.fill",
        accent: TarsTheme.warning,
        audience: .everyone,
        lessons: [

            // 1 — Crypto mechanics
            Lesson(
                id: "mac-crypto",
                title: "Crypto: Custody and the Market That Never Sleeps",
                minutes: 8,
                blocks: [
                    .heading("Different plumbing, same humans"),
                    .paragraph("Crypto assets settle on public blockchains rather than through brokers and clearinghouses. That changes custody fundamentally: hold your own keys and you truly possess the asset — and truly own every mistake. Lose the keys, lose the coins; no help desk, no reversal. Hold on an exchange and you're back to trusting an intermediary, some of which have historically been run with the rigor of a lemonade stand."),
                    .paragraph("The other structural difference: crypto trades 24/7, globally, with no opening bell and no circuit breakers on most venues. There's no overnight gap because there's no overnight — the price just keeps moving while you sleep, which is either a feature or a threat depending on your position."),
                    .keyIdea("The two questions that matter before anything else in crypto: who actually holds this asset, and what happens to my position at 3 a.m.? Volatility is famous; custody is what actually ruins people."),
                    .tarsAside("'Not your keys, not your coins' is the rare slogan that's also accurate. The sequel — 'your keys, your unrecoverable typo' — gets less airtime."),
                    .quiz(Quiz(
                        question: "You hold a crypto asset in a self-custody wallet and lose the private keys, with no backup. What are your options?",
                        options: [
                            "Contact the blockchain's support team to reset them",
                            "Wait 30 days for automatic recovery",
                            "There are none — the asset is permanently inaccessible",
                            "The exchange can restore access with ID verification"
                        ],
                        correctIndex: 2,
                        explanation: "Self-custody means no intermediary — which also means no recovery mechanism. There is no support team; the blockchain doesn't know or care who you are. This is the honest price of true ownership, and it's why custody deserves more thought than price predictions do."
                    ))
                ]
            ),

            // 2 — Futures & contango
            Lesson(
                id: "mac-futures",
                title: "Futures and the Shape of Time",
                minutes: 9,
                blocks: [
                    .heading("Contracts about later, priced today"),
                    .paragraph("A futures contract is an agreement to buy or sell something at a set price on a set future date. Farmers hedging harvests, airlines hedging fuel, funds expressing views — all trade standardized contracts with built-in leverage and daily cash settlement of gains and losses."),
                    .paragraph("Line up the prices of contracts expiring in successive months and you get the term structure. Later months priced higher than the spot price: contango — usually reflecting storage, insurance, and interest costs. Later months priced lower: backwardation — often a sign the thing is scarce right now."),
                    .widget(.termStructure),
                    .paragraph("Bend the curve above. The practical sting of contango: anything that must repeatedly sell a cheap expiring contract and buy a dearer later one — like many commodity ETFs — pays a toll every roll. The chart of the commodity and the chart of the fund quietly part ways."),
                    .keyIdea("The futures curve isn't a forecast — it's mostly a statement about the cost of carrying the thing through time. Reading it wrong is how people buy 'oil' and get contango instead."),
                    .paragraph("One thing to say plainly: futures are not tradable in Tars Trading yet. This lesson exists because the concepts — term structure, carry, roll costs — show up everywhere, including markets you can trade."),
                    .tarsAside("Contango sounds like a dance. It behaves like one too: two steps forward on the commodity, one step back on the roll, every single month.")
                ]
            ),

            // 3 — FX & carry
            Lesson(
                id: "mac-fx",
                title: "Currencies and the Carry Trade",
                minutes: 8,
                blocks: [
                    .heading("The biggest market you never see"),
                    .paragraph("Foreign exchange is the largest market on Earth — trillions of dollars a day — and it's all relative: every price is one currency measured in another. You're never just buying the yen; you're simultaneously selling the dollar. Every FX position is an opinion about two economies at once."),
                    .paragraph("The classic FX strategy is the carry trade: borrow in a currency with low interest rates, invest in one with high rates, pocket the differential. It works beautifully — until the exchange rate lurches against you and returns years of collected pennies in one afternoon. Traders describe it as picking up nickels in front of a steamroller, and they keep doing it anyway."),
                    .keyIdea("In FX, the interest-rate differential is the engine and the exchange rate is the weather. Carry trades earn steadily and lose suddenly — the profit distribution is lopsided in exactly the way that flatters a track record right up until it doesn't."),
                    .paragraph("FX isn't tradable here yet either. But carry — earning a spread for bearing a risk that arrives rarely and all at once — is a pattern worth recognizing in every market, including ones you can trade today."),
                    .tarsAside("Every few years the carry trade unwinds, the financial press discovers the steamroller, and everyone is shocked. The steamroller was on the schedule the whole time."),
                    .quiz(Quiz(
                        question: "A carry trade borrows yen at ~0% to buy a currency yielding 8%. What is the main risk?",
                        options: [
                            "The 8% rate could rise further",
                            "The high-yield currency could fall against the yen, wiping out years of interest gains quickly",
                            "There is no meaningful risk — the rate spread is locked in",
                            "Transaction fees exceed the interest earned"
                        ],
                        correctIndex: 1,
                        explanation: "The interest differential is real but small per unit of time; the exchange-rate risk is large and can arrive all at once. When carry trades unwind, the funding currency (here, the yen) tends to surge as everyone exits together — steamroller, meet nickels."
                    ))
                ]
            ),

            // 4 — Bonds & the yield curve
            Lesson(
                id: "mac-bonds",
                title: "Bonds and the Yield Curve",
                minutes: 9,
                blocks: [
                    .heading("The market that prices everything else"),
                    .paragraph("A bond is a loan with a schedule: you hand over principal, collect interest, and get the principal back at maturity — assuming the borrower holds up. Bond prices and yields move inversely: when rates rise, existing bonds paying yesterday's lower coupons are worth less. Longer maturities swing harder for the same rate move."),
                    .paragraph("Plot government bond yields against maturities and you get the yield curve. Normally it slopes upward — lending for longer earns more. When short yields rise above long ones, the curve inverts, which historically has preceded many recessions. Historically preceded — not caused, not guaranteed, and with famously awkward timing."),
                    .widget(.yieldCurveSculptor),
                    .paragraph("Sculpt the curve above. Drag the short end above the long end and watch the inversion form. This shape — not any stock chart — is what moves mortgages, corporate borrowing, currency flows, and the discount rate hiding inside every equity valuation."),
                    .keyIdea("The bond market sets the price of time and safety, and every other asset is priced against it. Equity people who ignore the yield curve are reading the novel without the first chapter."),
                    .paragraph("Bonds aren't tradable in Tars Trading yet. The curve still matters to you: it's upstream of nearly everything that is."),
                    .tarsAside("An inverted curve has predicted many recessions, and also a few that declined to show up. Respect the signal; skip the prophecy.")
                ]
            ),

            // 5 — Commodities
            Lesson(
                id: "mac-commodities",
                title: "Commodities: Atoms, Not Tickers",
                minutes: 7,
                blocks: [
                    .heading("Markets with weather"),
                    .paragraph("Commodities are the raw physical inputs — oil, gas, gold, copper, wheat, coffee. Unlike a share of a company, a barrel of oil has no management team, no earnings, and no ambition. Its price is set by physical supply and demand: OPEC meetings, droughts, freight rates, war, and the stubborn fact that the stuff has to be stored somewhere."),
                    .paragraph("That last part matters more than beginners expect. Storage is why commodity markets live on futures curves rather than simple spot prices, and why 'just buy oil and wait' is not actually a thing a retail account can cleanly do. The instruments that approximate it inherit the roll costs from the futures lesson."),
                    .keyIdea("A commodity's price reflects the physical world's balance sheet: production, storage, and demand. No cash flows, no compounding — which means the entire return depends on someone later paying more for the same atoms."),
                    .paragraph("Gold deserves its own sentence: it's less an industrial commodity than a four-thousand-year-old opinion poll about trust in institutions. It pays nothing, produces nothing, and refuses to go away — the market's longest-running argument."),
                    .tarsAside("Equities can compound. Wheat cannot. A share of a business can grow; a bushel just sits there being a bushel, waiting for the price of bushels to change."),
                    .paragraph("Commodities, like futures generally, aren't tradable here yet. But energy and materials companies in the equity universe are — and their earnings ride these prices, which is where this knowledge starts paying rent.")
                ]
            ),

            // 6 — How it all connects
            Lesson(
                id: "mac-connect",
                title: "How It All Connects",
                minutes: 9,
                blocks: [
                    .heading("One machine, many gauges"),
                    .paragraph("None of these markets exists in isolation. Rates are the master input: when yields rise, bonds reprice immediately, future corporate earnings are worth less today, higher-yielding currencies attract flows, gold's zero yield looks worse, and leveraged positions everywhere get more expensive to hold."),
                    .paragraph("Follow one shock through the machine. Oil spikes → energy costs push inflation up → central banks raise rates → bond prices fall and the curve shifts → the currency strengthens on higher yields → exporters' earnings compress → equity valuations adjust to a higher discount rate. Every arrow in that chain is a market someone trades."),
                    .keyIdea("Cross-asset thinking isn't about trading everything — it's about knowing what your positions are secretly exposed to. A portfolio of growth stocks is, among other things, a large bet on interest rates, whether its owner knows it or not."),
                    .paragraph("This is why diversification means more than owning many tickers. Thirty stocks that all suffer when rates rise is one trade wearing thirty costumes. Real diversification means exposures that fail for different reasons — and this track is your map of what those reasons are."),
                    .tarsAside("Everything is correlated in a crisis, the saying goes. Slightly more precisely: in a crisis, everyone sells whatever they can, and you find out which of your 'uncorrelated' assets were held by the same leveraged people."),
                    .quiz(Quiz(
                        question: "Central banks raise interest rates sharply. Which chain of effects is most consistent with how these markets connect?",
                        options: [
                            "Bond prices rise, gold becomes more attractive, growth stocks rally",
                            "Bond prices fall, the currency tends to strengthen, and richly-valued growth stocks face pressure from higher discount rates",
                            "Only banks are affected; other markets are independent",
                            "Commodities always double, since rates and oil move together"
                        ],
                        correctIndex: 1,
                        explanation: "Higher rates mean existing bonds' fixed coupons are worth less (prices fall), higher yields tend to attract foreign capital (currency strengthens), and future earnings are discounted more heavily — which bites hardest on stocks whose value lives far in the future. One input, many gauges: that's the machine."
                    ))
                ],
                mission: Mission(
                    id: "mac-mission-tars",
                    title: "Stress-test a thesis",
                    detail: "Ask Tars how a rate move, an oil spike, or a currency swing would touch something in your watchlist. Cross-asset questions are where the interesting answers live.",
                    verify: .askTars
                )
            )
        ]
    )
}
