import Foundation

// MARK: - Demo engine (offline, rule-based, surprisingly useful)

/// Ships in every build: a glossary-backed, context-aware mentor that works
/// with zero network. Also the graceful-degradation path when cloud is down.
struct DemoTarsEngine: TarsEngine {
    func reply(to message: String, context: TarsContext) -> AsyncStream<String> {
        let text = Self.compose(message: message, context: context)
        return stream(text)
    }

    private func stream(_ text: String) -> AsyncStream<String> {
        AsyncStream { continuation in
            Task {
                for word in text.split(separator: " ", omittingEmptySubsequences: false) {
                    continuation.yield(String(word) + " ")
                    try? await Task.sleep(for: .milliseconds(Int.random(in: 18...48)))
                }
                continuation.finish()
            }
        }
    }

    // MARK: Composition

    private static func compose(message: String, context: TarsContext) -> String {
        let q = message.lowercased()

        // Directive-advice asks get the standard redirect.
        if ["what should i buy", "what should i sell", "should i buy", "should i sell",
            "what stock", "which stock", "good buy", "tip"].contains(where: q.contains) {
            return TarsGuardrail.refusal
        }

        // Curriculum coaching — recommend from rank and progress, before the
        // glossary can shadow it ("learn about options" still hits glossary).
        if ["what should i learn", "what to learn", "what should i study",
            "what do i learn", "learn next", "next lesson", "where do i start",
            "where should i start", "what's next in the academy"].contains(where: q.contains) {
            return curriculumPlan(context)
        }

        // Glossary hit?
        if let hit = glossary.first(where: { q.contains($0.key) }) {
            return hit.value
        }

        // Context-aware replies.
        if q.contains("portfolio") || q.contains("how am i doing") || q.contains("my account") {
            let pnl = context.dayPnL
            let tone = pnl >= 0 ? "Up \(abs(Int(pnl))) today — enjoy it quietly; one green day is weather, not climate."
                                : "Down \(abs(Int(pnl))) today. Weather, not climate — the question is whether your theses are intact, not the tape."
            let posLine = context.positions.isEmpty
                ? "You're all cash right now, which is a position too — it's called patience."
                : "You hold \(context.positions.count) position\(context.positions.count == 1 ? "" : "s"); the one worth interrogating is your biggest: what would make you exit it?"
            var critique = "\(tone) \(posLine)"
            if context.academyStreakDays >= 2 {
                critique += " Meanwhile your \(context.academyStreakDays)-day study streak is quietly the best number on this screen."
            }
            return critique
        }
        if q.contains("what am i looking at"), let s = context.visibleSymbol {
            return "That's \(s). Before I explain the chart: what timeframe are you judging it on? A chart without a timeframe conviction is just modern art. Scrub the crosshair across a selloff and ask what the volume did — that's where the story usually is."
        }
        if q.contains("journal") || q.contains("thesis") {
            return "The journal is the whole game. A trade without a written thesis is a coin flip with extra steps — you can't learn from a decision you never articulated. Write what you expect, what would prove you wrong, and check back honestly. Win rate matters less than thesis rate."
        }
        if q.contains("hello") || q.contains("hi ") || q == "hi" || q.contains("who are you") {
            return "I'm Tars — your mentor, not your tipster. I explain instruments, critique your reasoning, and occasionally deflate your ego for its own good. Everything in here is simulated money, which is exactly why it's the right place to make your mistakes. What are we learning today?"
        }

        // Default: honest fallback with a nudge.
        return "Good question, and I'd rather teach it properly than improvise — in this offline mode I stick to what I know cold: order types, risk, the Greeks, portfolio math, market mechanics. Try me on any concept on screen (tap it), or ask 'how am I doing?' for a portfolio critique."
    }

    /// Study recommendations from actual standing — rank, open lesson, and the
    /// least-finished started track — never from vibes.
    private static func curriculumPlan(_ context: TarsContext) -> String {
        if let lesson = context.currentLessonTitle {
            return "Finish what's open: '\(lesson)'. Half-studied ideas are worse than unstudied ones — they feel like knowledge without behaving like it. When it's done, ask me again and I'll point at the next gap."
        }
        if let weak = context.weakestQuizArea {
            return "The honest answer is \(weak) — you started that track and stalled, which usually means it got uncomfortable, and uncomfortable is where the learning was about to happen. You're at \(context.academyXP) XP; go back in and keep the streak boring and daily."
        }
        switch context.academyRank {
        case nil, "Observer":
            return "Start with Foundations — order types, spreads, what a candle actually says. It looks basic; it's load-bearing, and everything else in this app quietly assumes it. One lesson today beats three on Saturday."
        case "Apprentice":
            return "At \(context.academyXP) XP the highest-value move is the Risk track: position sizing and drawdown math. Entries are the fun part; sizing is the surviving part. Learn it before your habits calcify."
        case "Practitioner":
            return "You've got the fundamentals down. Next is Options — Greeks before payoffs — or Macro, if you want to understand the tide your positions swim in. Pick the one you'd rather avoid; that's usually where the gap is."
        default:
            return "At \(context.academyRank ?? "your") rank the frontier is Funds and the Agent Lab: turning judgment into rules and testing them against history. Backtest something you actually believe — watching a favorite idea fail out-of-sample is the fastest education there is."
        }
    }

    /// Plain-English teaching notes, Tars-voiced. Keyed by trigger substring.
    private static let glossary: [(key: String, value: String)] = [
        ("limit order", "A limit order names your price and waits: buy at-or-below, sell at-or-above your limit. You trade certainty of price for certainty of execution — the market owes you nothing and may never come to you. Market orders are the opposite trade-off. Which certainty matters more for this trade?"),
        ("market order", "A market order says 'fill me now at whatever the market asks.' You get speed and certainty of execution, and you pay for it with slippage — the price can move between your tap and your fill. Fine for liquid names in calm tape; expensive in fast or thin markets."),
        ("stop loss", "A stop loss is a pre-commitment: 'if price hits X, get me out.' Its real function isn't the exit — it's forcing you to define, before entry, where your thesis is dead. If you can't name that price, you don't have a thesis yet."),
        ("short", "Short selling is selling borrowed shares hoping to rebuy cheaper. Profit is capped (price can only fall to zero); loss is uncapped (no ceiling). That asymmetry is why shorts size small and stay humble. In this app's demo mode I only let you sell what you hold."),
        ("bid", "The bid is the best price buyers will pay; the ask is the best price sellers will take. The gap — the spread — is the market's toll booth. Tight spreads mean liquidity; wide spreads mean you're paying real money just to enter and exit."),
        ("spread", "The bid-ask spread is the market's toll booth: the gap between what buyers will pay and sellers will take. You cross it on every round trip, so it's a real cost — small per trade, corrosive at high frequency. Liquid names have tight spreads; illiquid ones quietly tax you."),
        ("volume", "Volume is conviction made visible — how many shares actually changed hands. A price move on heavy volume means the crowd participated; the same move on air means few agreed and it reverses easier. Price tells you what happened; volume hints at whether to believe it."),
        ("candle", "Each candle compresses a battle into four numbers: open, high, low, close. Body = where the session settled; wicks = where price went and got rejected. A long lower wick says buyers showed up at the lows. Read a few hundred and they start talking."),
        ("volatility", "Volatility measures how violently price swings — it's the market's pulse, not its direction. High vol means wider outcomes both ways, which should mean smaller position sizes if your risk per trade is constant. Most blown accounts misjudged volatility, not direction."),
        ("diversif", "Diversification works because assets don't all fail the same way at the same time — it's the only free lunch in finance, and even it sends the bill during crises, when correlations lurch toward 1. Ten tech stocks isn't diversification; it's one bet wearing ten hats."),
        ("leverage", "Leverage multiplies both edges of the sword. 2x margin doubles gains AND losses, and adds a failure mode cash accounts don't have: the margin call, where the market decides your exit for you at the worst moment. Learn position sizing before you ever touch it."),
        ("p/e", "P/E divides price by yearly earnings — roughly, how many years of profit you're paying for upfront. High P/E means the market expects growth; it's optimism with a ticker. Useless alone, useful against the company's own history and its peers."),
        ("market cap", "Market cap = share price × share count: the market's sticker price for the whole company. It's why a $900 stock can be 'smaller' than a $150 one. Compare caps, never share prices — share price alone tells you nothing."),
        ("dividend", "A dividend is the company mailing you a slice of profit instead of reinvesting it. On payout day the share price drops by roughly the dividend — no free money, just profit changing pockets. The interesting signal is the streak: decades of raises say something about the business."),
        ("etf", "An ETF is a basket of assets wearing a single ticker — one trade buys the whole basket. Index ETFs like SPY are how most professionals tell amateurs to start, precisely because they remove the stock-picking you're probably here to do. Sit with that tension; it's a useful one."),
        ("option", "An option is a contract on a stock's future: calls profit from rises, puts from falls, both with an expiry date and a price (the premium) you can lose entirely. They offer leverage and defined risk — and a learning curve that eats the unprepared. The Academy's options track builds it up visually, piece by piece."),
        ("call", "A call option is the right — not the obligation — to buy stock at a set strike price before expiry. You pay a premium for that right; if the stock stays below the strike, the premium is the whole loss. Leverage with a built-in timer: the clock, not the direction, kills most call buyers."),
        ("put", "A put option is the right to sell at a set strike before expiry — it profits when the stock falls, which makes it both a bearish bet and portfolio insurance. Like all insurance, you mostly pay the premium and collect nothing. The question is what you're insuring against."),
        ("greek", "The Greeks measure an option's sensitivities: delta (price move), theta (time decay — the rent you pay daily), vega (volatility), gamma (how fast delta itself changes). Trade options without knowing them and you're flying instruments-off in weather. The Academy animates each one."),
        ("drawdown", "Drawdown is the fall from a peak to the following trough — the number that actually breaks traders, because a 50% loss needs a 100% gain just to get even. That asymmetry is the whole case for risk management. Survive first; compound second."),
        ("sharpe", "The Sharpe ratio asks: how much return per unit of volatility endured? Two accounts can both make 20% — the one that did it without the stomach-drops has the higher Sharpe. Fragile on short histories, so treat yours as a sketch, not a verdict."),
        ("beta", "Beta measures how much a stock moves when the market moves: 1 = in step, 2 = double the swing, negative = opposite. It's the difference between 'my stock is up' and 'everything is up.' Knowing your portfolio beta tells you how much of your P&L is just the tide."),
        ("hedge fund", "A hedge fund is a private pool running strategies public funds can't — short books, leverage, derivatives — charging handsomely for it ('2 and 20'). The Agent Lab here borrows the useful part: systematic strategies with strict risk limits, on simulated money, minus the fees and the mystique."),
        ("paper trading", "Paper trading is full-contact practice with simulated money — same decisions, same tape, no financial pain. Its known bug: without real loss, discipline is easy. Treat sizing and stops as if it were real or you're rehearsing habits that won't survive contact with a real account."),
        ("bracket", "A bracket order is a trade with its exits pre-attached: a take-profit above, a stop-loss below. The moment you're filled, both are working. It converts 'I'll decide later' — the most expensive sentence in trading — into a plan you set while you were still objective."),
        ("rsi", "RSI compresses recent momentum into 0–100: high readings flag overbought, low flag oversold. The catch — 'overbought' is not 'about to fall'; strong trends stay overbought for months. Momentum indicators describe the wave, they don't schedule its break."),
        ("moving average", "A moving average smooths price into a trend line — the market with its noise turned down. Price above a rising average is the textbook definition of uptrend. Crossovers make popular signals precisely because they're simple; the Agent Lab will let you test whether simple survives contact with history."),
        ("compound", "Compounding is returns earning returns — the exponential curve everyone quotes and few have the patience to ride. It needs time and it needs you to avoid large drawdowns, because big losses interrupt the curve where it hurts most: the steep part, later."),
        ("risk", "Risk management is deciding, before anything else, how much you can lose per idea — pros commonly risk under 1-2% of the account per trade. Entries get the attention; sizing does the surviving. Get sizing right and you can be wrong often and still be fine."),
    ]
}

// MARK: - Cloud engine (config-driven, OpenAI-compatible chat endpoint)

/// Talks to whatever open-weight host is configured in Secrets (vLLM, Together,
/// etc. — anything speaking the /chat/completions dialect). Falls back to
/// DemoTarsEngine upstream when unconfigured or failing.
struct CloudTarsEngine: TarsEngine {
    static var isConfigured: Bool {
        !Secrets.tarsCloudEndpoint.isEmpty && URL(string: Secrets.tarsCloudEndpoint) != nil
    }

    func reply(to message: String, context: TarsContext) -> AsyncStream<String> {
        AsyncStream { continuation in
            Task {
                do {
                    let text = try await complete(message: message, context: context)
                    let safe = TarsGuardrail.violates(text) ? TarsGuardrail.refusal : text
                    for word in safe.split(separator: " ", omittingEmptySubsequences: false) {
                        continuation.yield(String(word) + " ")
                        try? await Task.sleep(for: .milliseconds(14))
                    }
                } catch {
                    // Graceful degradation: the demo brain answers instead.
                    for await chunk in DemoTarsEngine().reply(to: message, context: context) {
                        continuation.yield(chunk)
                    }
                }
                continuation.finish()
            }
        }
    }

    private func complete(message: String, context: TarsContext) async throws -> String {
        struct Msg: Codable { let role: String; let content: String }
        struct Req: Codable {
            let model: String
            let messages: [Msg]
            let maxTokens: Int
            let temperature: Double
        }
        struct Choice: Decodable { let message: Msg }
        struct Reply: Decodable { let choices: [Choice] }

        let url = URL(string: Secrets.tarsCloudEndpoint)!
        let req = Req(model: "tars-mentor",
                      messages: [
                        Msg(role: "system", content: TarsGuardrail.systemPrompt),
                        Msg(role: "system", content: "Current app context:\n" + context.summaryPrompt),
                        Msg(role: "user", content: message),
                      ],
                      maxTokens: 400, temperature: 0.7)
        let http = HTTPClient()
        let reply = try await http.send(Reply.self, url: url, method: "POST", body: req,
                                        headers: ["Authorization": "Bearer \(Secrets.tarsCloudKey)"])
        guard let content = reply.choices.first?.message.content, !content.isEmpty else {
            throw TarsError.network("Empty completion")
        }
        return content
    }
}
