import SwiftUI
import Charts

/// OPTIONS SANDBOX — a model-priced practice chain, deliberately separate from
/// the paper account. Premiums come from a simplified Black-Scholes model fed
/// by the live demo underlying, so learners can watch moneyness, skew, and
/// theta behave without pretending this is a real options market. Positions
/// live in a local sandbox book and never touch TradingStore.
public struct OptionsChainView: View {
    public let symbol: String

    public init(symbol: String) { self.symbol = symbol }

    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var book = OCSandboxBook.shared
    @State private var dte: Int = 30
    @State private var ticket: OCTicketContext?
    @State private var fallbackQuote: Quote?

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                sandboxBanner
                underlyingHeader
                expiryPicker
                skewSection
                ladderSection
                bookSection
                footerCaption
            }
            .padding(TarsTheme.Space.xl)
        }
        .background(TarsTheme.bg0.ignoresSafeArea())
        .navigationTitle("Options \u{00B7} \(symbol)")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $ticket) { context in
            OCTicketSheet(symbol: symbol, context: context, book: book)
        }
        .task(id: symbol) {
            // Keep a fallback quote flowing if the symbol isn't in the
            // watchlist/positions refresh loop, so theta and marks stay live.
            while !Task.isCancelled {
                if store.quote(for: symbol) == nil {
                    fallbackQuote = try? await store.marketData.quotes(for: [symbol]).first
                }
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    // MARK: - Derived pricing state

    private var spot: Double? { (store.quote(for: symbol) ?? fallbackQuote)?.price }

    private var baseVol: Double {
        DemoMarket.universe.first { $0.symbol == symbol }?.annualVol ?? 0.30
    }

    private var yearsToExpiry: Double { Double(dte) / 365.0 }

    private var rows: [OCRow] {
        guard let spot, spot > 0 else { return [] }
        let step = ocStrikeStep(for: spot)
        var strikes: [Double] = []
        var k = (spot * 0.8 / step).rounded(.up) * step
        while k <= spot * 1.2 + 0.0001 {
            strikes.append(k)
            k += step
        }
        let T = yearsToExpiry
        return strikes.map { strike in
            let iv = ocSmileIV(base: baseVol, spot: spot, strike: strike)
            let call = OCBS.price(isCall: true, S: spot, K: strike, T: T, v: iv)
            let put = OCBS.price(isCall: false, S: spot, K: strike, T: T, v: iv)
            let cs = ocHalfSpread(call), ps = ocHalfSpread(put)
            return OCRow(strike: strike, iv: iv,
                         callBid: max(0, call - cs), callAsk: call + cs,
                         putBid: max(0, put - ps), putAsk: put + ps)
        }
    }

    private var atmStrike: Double? {
        guard let spot else { return nil }
        return rows.min { abs($0.strike - spot) < abs($1.strike - spot) }?.strike
    }

    // MARK: - Banner

    private var sandboxBanner: some View {
        HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
            Text("SANDBOX")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.bg0)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, TarsTheme.Space.xs)
                .background(Capsule(style: .continuous).fill(TarsTheme.paperBadge))
            Text("Options practice book \u{2014} separate from your paper account. Model prices, not market quotes.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }

    // MARK: - Underlying

    private var underlyingHeader: some View {
        HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
            Text(symbol)
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            if let spot {
                TickerText(value: spot, font: TarsTheme.Text.price)
                Text("underlying")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            } else {
                SkeletonBlock(width: 110, height: 17)
            }
            Spacer()
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Expiry picker

    private var expiryPicker: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.s) {
                ForEach([7, 30, 60], id: \.self) { days in
                    Button {
                        Haptics.tick()
                        withAnimation(reduceMotion ? nil : Motion.fluid) { dte = days }
                    } label: {
                        Text("\(days) DTE")
                            .font(TarsTheme.Text.caption)
                            .monospacedDigit()
                            .foregroundStyle(dte == days ? TarsTheme.bg0 : TarsTheme.inkSecondary)
                            .padding(.horizontal, TarsTheme.Space.l)
                            .padding(.vertical, TarsTheme.Space.s)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(dte == days ? TarsTheme.accent : TarsTheme.bg3)
                            )
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("\(days) days to expiry")
                    .accessibilityAddTraits(dte == days ? .isSelected : [])
                }
                Spacer()
            }
            Text("Flip the expiry and watch every premium shrink toward 7 DTE. That's theta \u{2014} time value leaving quietly, every day, whether you're watching or not.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - IV skew

    private var skewSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.s) {
                Text("Implied volatility by strike")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text("SIMPLIFIED")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.vertical, 2)
                    .background(
                        Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1)
                    )
            }
            if rows.isEmpty {
                SkeletonBlock(height: 88)
            } else {
                Chart {
                    ForEach(rows) { row in
                        LineMark(
                            x: .value("Strike", row.strike),
                            y: .value("IV", row.iv))
                        .foregroundStyle(TarsTheme.accent)
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    }
                    if let spot {
                        RuleMark(x: .value("Spot", spot))
                            .foregroundStyle(TarsTheme.inkTertiary.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                            .annotation(position: .top, alignment: .center) {
                                Text("spot")
                                    .font(TarsTheme.Text.micro)
                                    .foregroundStyle(TarsTheme.inkTertiary)
                            }
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 3)) {
                        AxisGridLine().foregroundStyle(TarsTheme.hairline)
                        AxisValueLabel(format: FloatingPointFormatStyle<Double>.Percent.percent.precision(.fractionLength(0)))
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) {
                        AxisGridLine().foregroundStyle(TarsTheme.hairline)
                        AxisValueLabel()
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .frame(height: 88)
                .animation(reduceMotion ? nil : Motion.ticker, value: dte)
                .accessibilityLabel("Simplified implied volatility smile: lower strikes carry higher implied volatility than upside strikes, with a mild smile at both ends. Synthesized for practice, not market data.")
            }
            Text("A synthesized smile: markets usually charge more implied volatility for downside strikes. Real surfaces are messier.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    // MARK: - Ladder

    private var ladderSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            ladderHeader
            if rows.isEmpty {
                VStack(spacing: TarsTheme.Space.s) {
                    ForEach(0..<8, id: \.self) { _ in
                        SkeletonBlock(height: 34)
                    }
                }
            } else {
                VStack(spacing: TarsTheme.Space.xs) {
                    ForEach(rows) { row in
                        ladderRow(row)
                    }
                }
                Text("Bid and ask are the model's theoretical value \u{00B1} a synthetic spread. Tap a side to open a practice ticket.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    private var ladderHeader: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Text("CALLS \u{00B7} BID / ASK")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("STRIKE")
                .frame(width: 84)
            Text("PUTS \u{00B7} BID / ASK")
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(TarsTheme.Text.micro)
        .foregroundStyle(TarsTheme.inkTertiary)
        .accessibilityHidden(true)
    }

    private func ladderRow(_ row: OCRow) -> some View {
        let isATM = row.strike == atmStrike
        let callITM = (spot ?? 0) > row.strike
        let putITM = (spot ?? 0) < row.strike
        return HStack(spacing: TarsTheme.Space.s) {
            premiumButton(row: row, isCall: true, inTheMoney: callITM, alignTrailing: false)
            strikeCell(row.strike, isATM: isATM)
            premiumButton(row: row, isCall: false, inTheMoney: putITM, alignTrailing: true)
        }
    }

    private func premiumButton(row: OCRow, isCall: Bool, inTheMoney: Bool, alignTrailing: Bool) -> some View {
        let bid = isCall ? row.callBid : row.putBid
        let ask = isCall ? row.callAsk : row.putAsk
        return Button {
            Haptics.tap()
            ticket = OCTicketContext(isCall: isCall, strike: row.strike, dte: dte)
        } label: {
            HStack(spacing: TarsTheme.Space.s) {
                if alignTrailing { Spacer(minLength: 0) }
                Text(bid, format: ocPremiumFormat)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text(ask, format: ocPremiumFormat)
                    .foregroundStyle(TarsTheme.inkPrimary)
                if !alignTrailing { Spacer(minLength: 0) }
            }
            .font(TarsTheme.Text.priceSmall)
            .contentTransition(.numericText())
            .animation(reduceMotion ? nil : Motion.ticker, value: bid)
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.s)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(inTheMoney ? TarsTheme.accent.opacity(0.10) : TarsTheme.bg2)
            )
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(isCall ? "Call" : "Put") at strike \(row.strike.formatted(.number.precision(.fractionLength(0...2)))), bid \(bid.formatted(.currency(code: "USD"))), ask \(ask.formatted(.currency(code: "USD"))). Opens the sandbox ticket.")
    }

    private func strikeCell(_ strike: Double, isATM: Bool) -> some View {
        Text(strike, format: .number.precision(.fractionLength(strike < 100 ? 1 : 0)))
            .font(TarsTheme.Text.priceSmall)
            .foregroundStyle(isATM ? TarsTheme.accent : TarsTheme.inkSecondary)
            .frame(width: 84)
            .padding(.vertical, TarsTheme.Space.s)
            .background(
                Capsule(style: .continuous)
                    .strokeBorder(isATM ? TarsTheme.accent.opacity(0.6) : .clear, lineWidth: 1)
            )
            .accessibilityLabel(isATM ? "Strike \(strike.formatted()), at the money" : "Strike \(strike.formatted())")
    }

    // MARK: - Sandbox book

    private var bookSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Text("Sandbox book")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("PRACTICE ONLY")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.paperBadge)
                Spacer()
            }
            if book.legs.isEmpty && book.realized == 0 {
                emptyBook
            } else {
                totalsRow
                ForEach(book.legs) { leg in
                    bookRow(leg)
                }
                Text("Marks are model mids \u{2014} a real fill would cross the bid\u{2013}ask spread and cost more. And theta doesn't take weekends off in this model.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    private var emptyBook: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "tray")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Nothing here yet.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text("Tap a premium in the ladder to open a practice position. The model keeps score; nobody else has to know.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xl)
    }

    private var totalsRow: some View {
        let unrealized = book.legs.reduce(0.0) { $0 + OCSandboxBook.pnl($1, mark: markPremium(for: $1)) }
        return HStack(spacing: TarsTheme.Space.xl) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Open P&L (model)")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                TickerText(value: unrealized, font: TarsTheme.Text.price)
            }
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Realized")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Text(book.realized, format: .currency(code: "USD"))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.pnl(book.realized))
                    .contentTransition(.numericText(value: book.realized))
                    .animation(reduceMotion ? nil : Motion.ticker, value: book.realized)
            }
            Spacer()
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg2)
        )
        .accessibilityElement(children: .combine)
    }

    private func bookRow(_ leg: OCLeg) -> some View {
        let mark = markPremium(for: leg)
        let pnl = OCSandboxBook.pnl(leg, mark: mark)
        let expired = leg.expiry <= .now
        let dteLeft = max(0, Int((leg.expiry.timeIntervalSinceNow / 86_400).rounded(.up)))
        return VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("\(leg.symbol) \(leg.strike.formatted(.number.precision(.fractionLength(0...2)))) \(leg.isCall ? "C" : "P")")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("\(leg.isLong ? "Long" : "Short") \(leg.contracts) \u{00D7} \(leg.entryPremium.formatted(.currency(code: "USD"))) \u{00B7} \(expired ? "expired \u{2014} intrinsic value only" : "\(dteLeft) DTE left")")
                        .font(TarsTheme.Text.caption)
                        .monospacedDigit()
                        .foregroundStyle(expired ? TarsTheme.warning : TarsTheme.inkSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: TarsTheme.Space.xs) {
                    TickerText(value: pnl, font: TarsTheme.Text.price)
                    HStack(spacing: TarsTheme.Space.xs) {
                        Text("mark")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                        Text(mark, format: ocPremiumFormat)
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .contentTransition(.numericText())
                            .animation(reduceMotion ? nil : Motion.ticker, value: mark)
                    }
                }
            }
            Button {
                Haptics.fill()
                withAnimation(reduceMotion ? nil : Motion.fluid) {
                    book.close(leg, mark: mark)
                }
            } label: {
                Text("Close \u{00B7} realize \(pnl.formatted(.currency(code: "USD")))")
                    .font(TarsTheme.Text.caption)
                    .monospacedDigit()
                    .foregroundStyle(TarsTheme.pnl(pnl))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, TarsTheme.Space.s)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                    )
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Close \(leg.symbol) \(leg.isCall ? "call" : "put") position and realize \(pnl.formatted(.currency(code: "USD")))")
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg2)
        )
    }

    private var footerCaption: some View {
        Text("Premiums here come from a model, not a market. Real option quotes include real people on the other side, and they are not doing you a favor. \u{2014} Tars")
            .font(TarsTheme.Text.caption)
            .foregroundStyle(TarsTheme.inkTertiary)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Mark-to-model

    private func markPremium(for leg: OCLeg) -> Double {
        let underlying = underlyingPrice(for: leg)
        let T = max(0, leg.expiry.timeIntervalSinceNow) / (365 * 86_400)
        let vol = DemoMarket.universe.first { $0.symbol == leg.symbol }?.annualVol ?? 0.30
        let iv = ocSmileIV(base: vol, spot: underlying, strike: leg.strike)
        return OCBS.price(isCall: leg.isCall, S: underlying, K: leg.strike, T: T, v: iv)
    }

    private func underlyingPrice(for leg: OCLeg) -> Double {
        if let q = store.quote(for: leg.symbol) { return q.price }
        if leg.symbol == symbol, let spot { return spot }
        let demo = DemoMarket.shared.price(of: leg.symbol)
        return demo > 0 ? demo : leg.entryUnderlying
    }
}

// MARK: - Ticket sheet (fileprivate)

fileprivate struct OCTicketSheet: View {
    let symbol: String
    let context: OCTicketContext
    let book: OCSandboxBook

    @Environment(TradingStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var isLong = true
    @State private var contracts = 1

    private var spot: Double? { store.quote(for: symbol)?.price ?? demoSpot }
    private var demoSpot: Double? {
        let p = DemoMarket.shared.price(of: symbol)
        return p > 0 ? p : nil
    }
    private var baseVol: Double {
        DemoMarket.universe.first { $0.symbol == symbol }?.annualVol ?? 0.30
    }
    private var T: Double { Double(context.dte) / 365.0 }

    private var iv: Double {
        guard let spot else { return baseVol }
        return ocSmileIV(base: baseVol, spot: spot, strike: context.strike)
    }
    private var theo: Double {
        guard let spot else { return 0 }
        return OCBS.price(isCall: context.isCall, S: spot, K: context.strike, T: T, v: iv)
    }
    private var bid: Double { max(0, theo - ocHalfSpread(theo)) }
    private var ask: Double { theo + ocHalfSpread(theo) }
    /// Long crosses the spread and pays the ask; short receives the bid.
    private var fillPremium: Double { isLong ? ask : bid }
    private var totalDollars: Double { fillPremium * 100 * Double(contracts) }
    private var greeks: OCGreeks {
        guard let spot else { return OCGreeks() }
        return OCBS.greeks(isCall: context.isCall, S: spot, K: context.strike, T: T, v: iv)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                    header
                    sideToggle
                    contractsStepper
                    costCard
                    greeksRow
                    confirmButton
                }
                .padding(TarsTheme.Space.xl)
            }
            .background(TarsTheme.bg0.ignoresSafeArea())
            .navigationTitle("Sandbox ticket")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(TarsTheme.bg1)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.s) {
                Text("SANDBOX")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.vertical, 2)
                    .background(Capsule(style: .continuous).fill(TarsTheme.paperBadge))
                Text("Practice book only \u{2014} not your paper account.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Text("\(symbol) \(context.strike.formatted(.number.precision(.fractionLength(0...2)))) \(context.isCall ? "Call" : "Put") \u{00B7} \(context.dte) DTE")
                .font(TarsTheme.Text.title)
                .monospacedDigit()
                .foregroundStyle(TarsTheme.inkPrimary)
            HStack(spacing: TarsTheme.Space.m) {
                Text("theo \(theo.formatted(ocPremiumFormat))")
                Text("bid \(bid.formatted(ocPremiumFormat))")
                Text("ask \(ask.formatted(ocPremiumFormat))")
                Text("IV \(iv.formatted(.percent.precision(.fractionLength(0))))")
            }
            .font(TarsTheme.Text.priceSmall)
            .foregroundStyle(TarsTheme.inkSecondary)
        }
    }

    private var sideToggle: some View {
        HStack(spacing: TarsTheme.Space.s) {
            sideButton(long: true, label: "Long \u{00B7} buy to open")
            sideButton(long: false, label: "Short \u{00B7} sell to open")
        }
    }

    private func sideButton(long: Bool, label: String) -> some View {
        Button {
            Haptics.tick()
            withAnimation(reduceMotion ? nil : Motion.snappy) { isLong = long }
        } label: {
            Text(label)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(isLong == long ? TarsTheme.bg0 : TarsTheme.inkSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(isLong == long ? (long ? TarsTheme.gain : TarsTheme.loss) : TarsTheme.bg3)
                )
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(isLong == long ? .isSelected : [])
    }

    private var contractsStepper: some View {
        HStack {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Contracts")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text("1 contract = 100 shares of \(symbol)")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
            Stepper(value: $contracts, in: 1...20) {
                Text("\(contracts)")
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText(value: Double(contracts)))
                    .animation(reduceMotion ? nil : Motion.snappy, value: contracts)
            }
            .onChange(of: contracts) { _, _ in Haptics.tick() }
            .fixedSize()
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    private var costCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(alignment: .firstTextBaseline) {
                Text(isLong ? "Debit \u{2014} you pay" : "Credit \u{2014} you collect")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text(totalDollars, format: .currency(code: "USD"))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(isLong ? TarsTheme.inkPrimary : TarsTheme.gain)
                    .contentTransition(.numericText(value: totalDollars))
                    .animation(reduceMotion ? nil : Motion.ticker, value: totalDollars)
            }
            Text("\(fillPremium.formatted(ocPremiumFormat)) premium \u{00D7} 100 multiplier \u{00D7} \(contracts) contract\(contracts == 1 ? "" : "s"). Options are quoted per share, but each contract controls 100 \u{2014} that multiplier is where beginners get surprised.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
            if !isLong {
                Text("Short options collect the credit up front, but the loss is not capped at what you collected. That asymmetry is the whole lesson.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.warning)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    private var greeksRow: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("Greeks (per share)")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
            HStack(spacing: TarsTheme.Space.s) {
                OCGreekCell(name: "\u{0394} Delta", value: greeks.delta.formatted(.number.precision(.fractionLength(2)).sign(strategy: .always(includingZero: false))))
                OCGreekCell(name: "\u{0393} Gamma", value: greeks.gamma.formatted(.number.precision(.fractionLength(3))))
                OCGreekCell(name: "\u{0398} Theta/d", value: greeks.thetaPerDay.formatted(.number.precision(.fractionLength(3))))
                OCGreekCell(name: "V Vega/pt", value: greeks.vegaPerPoint.formatted(.number.precision(.fractionLength(3))))
            }
            Text("Multiply by 100 for one contract. Theta is what this position loses to time per day if nothing else moves.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    private var confirmButton: some View {
        Button {
            guard let spot else { return }
            let leg = OCLeg(
                symbol: symbol,
                isCall: context.isCall,
                isLong: isLong,
                strike: context.strike,
                contracts: contracts,
                entryPremium: fillPremium,
                entryUnderlying: spot,
                expiry: Date.now.addingTimeInterval(Double(context.dte) * 86_400),
                openedAt: .now)
            book.open(leg)
            Haptics.confirm()
            dismiss()
        } label: {
            Text("Add to sandbox book")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.bg0)
                .frame(maxWidth: .infinity)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .fill(TarsTheme.accent)
                )
        }
        .buttonStyle(PressableStyle())
        .disabled(spot == nil)
        .opacity(spot == nil ? 0.5 : 1)
        .accessibilityLabel("Add \(isLong ? "long" : "short") \(contracts) \(context.isCall ? "call" : "put") contract\(contracts == 1 ? "" : "s") to the sandbox book")
    }
}

fileprivate struct OCGreekCell: View {
    let name: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Text(name)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text(value)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3)
        )
    }
}

// MARK: - Sandbox book store (fileprivate, persisted)

fileprivate struct OCLeg: Identifiable, Codable, Equatable {
    var id = UUID()
    var symbol: String
    var isCall: Bool
    var isLong: Bool
    var strike: Double
    var contracts: Int
    var entryPremium: Double
    var entryUnderlying: Double
    var expiry: Date
    var openedAt: Date
}

fileprivate struct OCBookFile: Codable {
    var legs: [OCLeg]
    var realized: Double
}

/// The sandbox book: options practice positions marked to model. Deliberately
/// NOT routed through TradingStore — this book never touches the paper account.
@Observable
fileprivate final class OCSandboxBook {
    static let shared = OCSandboxBook()

    var legs: [OCLeg] = []
    var realized: Double = 0

    @ObservationIgnored private let persistence = Persistence()

    init() {
        if let file = persistence.load(OCBookFile.self, "optionsSandboxBook") {
            legs = file.legs
            realized = file.realized
        }
    }

    func open(_ leg: OCLeg) {
        legs.insert(leg, at: 0)
        save()
    }

    func close(_ leg: OCLeg, mark: Double) {
        realized += Self.pnl(leg, mark: mark)
        legs.removeAll { $0.id == leg.id }
        save()
    }

    /// Signed P&L in dollars: (mark − entry) × 100 × contracts, flipped for shorts.
    static func pnl(_ leg: OCLeg, mark: Double) -> Double {
        (mark - leg.entryPremium) * 100 * Double(leg.contracts) * (leg.isLong ? 1 : -1)
    }

    private func save() {
        persistence.save(OCBookFile(legs: legs, realized: realized), "optionsSandboxBook")
    }
}

// MARK: - Chain row & ticket context (fileprivate)

fileprivate struct OCRow: Identifiable {
    var id: Double { strike }
    let strike: Double
    let iv: Double
    let callBid: Double
    let callAsk: Double
    let putBid: Double
    let putAsk: Double
}

fileprivate struct OCTicketContext: Identifiable {
    let id = UUID()
    let isCall: Bool
    let strike: Double
    let dte: Int
}

// MARK: - Black-Scholes (fileprivate; OptionsWidgets.swift has its own copy)

fileprivate struct OCGreeks {
    var delta = 0.0
    var gamma = 0.0
    var thetaPerDay = 0.0
    var vegaPerPoint = 0.0
}

fileprivate enum OCBS {
    /// Sandbox risk-free rate: a flat 4%.
    static let r = 0.04

    static func pdf(_ x: Double) -> Double {
        exp(-x * x / 2) / (2 * Double.pi).squareRoot()
    }

    /// Standard normal CDF, Abramowitz–Stegun polynomial approximation.
    static func cdf(_ x: Double) -> Double {
        let k = 1 / (1 + 0.2316419 * abs(x))
        let poly = k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))))
        let c = 1 - pdf(x) * poly
        return x >= 0 ? c : 1 - c
    }

    static func price(isCall: Bool, S: Double, K: Double, T: Double, v: Double) -> Double {
        guard S > 0, K > 0 else { return 0 }
        guard T > 1e-6, v > 1e-6 else {
            return isCall ? max(0, S - K) : max(0, K - S)   // intrinsic at/after expiry
        }
        let sqrtT = T.squareRoot()
        let d1 = (Foundation.log(S / K) + (r + v * v / 2) * T) / (v * sqrtT)
        let d2 = d1 - v * sqrtT
        if isCall {
            return S * cdf(d1) - K * exp(-r * T) * cdf(d2)
        } else {
            return K * exp(-r * T) * cdf(-d2) - S * cdf(-d1)
        }
    }

    static func greeks(isCall: Bool, S: Double, K: Double, T: Double, v: Double) -> OCGreeks {
        guard S > 0, K > 0, T > 1e-6, v > 1e-6 else { return OCGreeks() }
        let sqrtT = T.squareRoot()
        let d1 = (Foundation.log(S / K) + (r + v * v / 2) * T) / (v * sqrtT)
        let d2 = d1 - v * sqrtT
        let delta = isCall ? cdf(d1) : cdf(d1) - 1
        let gamma = pdf(d1) / (S * v * sqrtT)
        let annualTheta: Double = isCall
            ? -S * pdf(d1) * v / (2 * sqrtT) - r * K * exp(-r * T) * cdf(d2)
            : -S * pdf(d1) * v / (2 * sqrtT) + r * K * exp(-r * T) * cdf(-d2)
        let vega = S * pdf(d1) * sqrtT / 100   // per 1 vol point
        return OCGreeks(delta: delta, gamma: gamma, thetaPerDay: annualTheta / 365, vegaPerPoint: vega)
    }
}

// MARK: - Chain math helpers (fileprivate)

/// Synthesized volatility smile: downside strikes charge more IV, with a mild
/// smile at both wings. Deliberately simplified for teaching.
fileprivate func ocSmileIV(base: Double, spot: Double, strike: Double) -> Double {
    guard spot > 0 else { return base }
    let m = strike / spot - 1
    let iv = base * (1 - 0.35 * m + 1.9 * m * m)
    return min(max(iv, base * 0.55), base * 1.9)
}

/// Synthetic half-spread around the theoretical value.
fileprivate func ocHalfSpread(_ theo: Double) -> Double {
    max(0.01, theo * 0.02)
}

/// Sensible strike increments by underlying price.
fileprivate func ocStrikeStep(for spot: Double) -> Double {
    switch spot {
    case ..<25: 0.5
    case ..<50: 1
    case ..<100: 2.5
    case ..<250: 5
    case ..<500: 10
    case ..<1000: 25
    default: 50
    }
}

fileprivate let ocPremiumFormat = FloatingPointFormatStyle<Double>.Currency
    .currency(code: "USD").precision(.fractionLength(2))
