import SwiftUI

/*
  The instrument dossier — what a market IS, told differently depending on
  what KIND of thing it is.

  A stock's story is its business and its day range. A future's story is
  its contract: what month, what margin, what a tick is worth. An index's
  story is that you CAN'T BUY IT — the most important sentence on the
  screen, and the one every other app leaves out. An FX pair's story is
  that it moves in pips and marks at ECB rates.

  Everything here is server-stated or bundled fact. Nothing is estimated
  on the phone, and a field the server didn't send simply doesn't appear
  rather than showing a confident zero.
*/

// MARK: - The shared shell

/// A titled block of the dossier. One container, so ten sections can't
/// drift into ten designs.
struct DossierSection<Content: View>: View {
    let title: String
    var note: String? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TarsMicroLabel(title)
            content
            if let note {
                Text(note)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }
}

/// A labelled value. The workhorse of the whole dossier.
struct DossierStat: View {
    let label: String
    let value: String
    var tone: Color? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .kerning(0.6)
                .foregroundStyle(TarsTheme.inkQuaternary)
                .lineLimit(1).minimumScaleFactor(0.8)
            Text(value)
                .font(TarsTheme.Text.body.monospacedDigit().weight(.semibold))
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Where today's price sits between two bounds — the shape of a range,
/// which a pair of numbers alone never shows.
struct RangeBar: View {
    let low: Double
    let high: Double
    let value: Double
    let symbol: String
    var lowLabel = "Low"
    var highLabel = "High"

    private var t: Double {
        guard high > low else { return 0.5 }
        return min(max((value - low) / (high - low), 0), 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(TarsTheme.bg3).frame(height: 4)
                    // Inset by the dot's width so the marker never falls off
                    // the end of its own track at the extremes.
                    Circle().fill(TarsTheme.inkPrimary)
                        .frame(width: 10, height: 10)
                        .offset(x: (geo.size.width - 10) * t)
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 12)
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(lowLabel.uppercased())
                        .font(.system(size: 8, weight: .semibold, design: .monospaced))
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Text(SymbolDisplay.price(symbol, low))
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(highLabel.uppercased())
                        .font(.system(size: 8, weight: .semibold, design: .monospaced))
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Text(SymbolDisplay.price(symbol, high))
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(lowLabel) \(SymbolDisplay.price(symbol, low)), "
                            + "\(highLabel) \(SymbolDisplay.price(symbol, high)), "
                            + "now \(Int(t * 100)) percent up the range")
    }
}

// MARK: - The dossier itself

struct InstrumentDossier: View {
    let symbol: String
    let stats: APIStats?
    let quote: APIQuote?
    var category: String? = nil
    /// Live initial-margin preview, futures only — the server's own number.
    var futuresMargin: MarginPreview? = nil
    /// Tapping a related market (an index's tradable proxies).
    var onOpen: (String) -> Void = { _ in }
    /// Opening the lesson that explains this kind of instrument.
    var onLearn: (String) -> Void = { _ in }

    private var kind: Instruments.Kind { Instruments.kind(symbol, category: category) }
    private var profile: Instruments.Profile? { Instruments.profile(symbol) }

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            whatItIs
            // An index can't be bought — say so before any price detail,
            // because it changes what the rest of the screen means.
            if kind == .index { indexWarning }
            todaySection
            if kind == .future { futuresSection }
            if kind == .fx { fxSection }
            if kind == .crypto { cryptoSection }
            longRangeSection
            liquiditySection
        }
    }

    // MARK: What it is — the beginner's first question

    @ViewBuilder private var whatItIs: some View {
        DossierSection(title: "What this is") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                Text(Instruments.what(symbol, kind: kind))
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if let moves = profile?.moves {
                    Divider().overlay(TarsTheme.hairline)
                    VStack(alignment: .leading, spacing: 3) {
                        TarsMicroLabel("What moves it", tone: TarsTheme.inkQuaternary)
                        Text(moves)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Divider().overlay(TarsTheme.hairline)
                VStack(alignment: .leading, spacing: 3) {
                    TarsMicroLabel("How it trades here", tone: TarsTheme.inkQuaternary)
                    Text(Instruments.how(kind))
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // The bridge the product never had: confusion, meet lesson.
                if let link = Instruments.lessonFor(kind, symbol: symbol) {
                    Button {
                        Haptics.tap()
                        onLearn(link.id)
                    } label: {
                        HStack(spacing: TarsTheme.Space.s) {
                            Image(systemName: "graduationcap")
                            Text(link.label)
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(TarsTheme.Text.micro)
                        }
                        .font(TarsTheme.Text.caption.weight(.semibold))
                        .foregroundStyle(TarsTheme.accent)
                        .padding(TarsTheme.Space.m)
                        .background(TarsTheme.accent.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// The sentence no other app says plainly.
    private var indexWarning: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "info.circle.fill")
                    .foregroundStyle(TarsTheme.accent)
                Text("You can't buy this number")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            Text("An index is a measurement, not a security. To take a position on it, trade a fund that tracks it or its futures contract.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            let proxies = Self.tradableProxies[SymbolDisplay.pretty(symbol)] ?? []
            if !proxies.isEmpty {
                HStack(spacing: TarsTheme.Space.s) {
                    ForEach(proxies, id: \.self) { p in
                        Button {
                            Haptics.tap(); onOpen(p)
                        } label: {
                            Text(p)
                                .font(TarsTheme.Text.caption.weight(.semibold))
                                .foregroundStyle(TarsTheme.accent)
                                .padding(.horizontal, TarsTheme.Space.m)
                                .frame(minHeight: 40)
                                .background(TarsTheme.accent.opacity(0.12))
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.l)
        .background(TarsTheme.accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
            .strokeBorder(TarsTheme.accent.opacity(0.28), lineWidth: 1))
    }

    /// Which real, tradable things track each measurement.
    static let tradableProxies: [String: [String]] = [
        "SPX": ["SPY", "VOO"], "NDX": ["QQQ"], "DJI": ["DIA"],
        "RUT": ["IWM"], "COMP": ["QQQ"], "VIX": ["UVIX", "VXX"],
    ]

    // MARK: Today

    @ViewBuilder private var todaySection: some View {
        if let s = stats {
            DossierSection(title: "Today") {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    HStack(spacing: TarsTheme.Space.m) {
                        if let o = s.open { DossierStat(label: "Open", value: SymbolDisplay.price(symbol, o)) }
                        if let pc = s.prevClose { DossierStat(label: "Prev close", value: SymbolDisplay.price(symbol, pc)) }
                        if let c = s.change {
                            DossierStat(label: "Change", value: SymbolDisplay.price(symbol, c),
                                        tone: TarsTheme.pnl(c))
                        }
                    }
                    if let lo = s.dayLow, let hi = s.dayHigh, let px = s.price, hi > lo {
                        RangeBar(low: lo, high: hi, value: px, symbol: symbol,
                                 lowLabel: "Day low", highLabel: "Day high")
                    }
                }
            }
        }
    }

    // MARK: The long view

    @ViewBuilder private var longRangeSection: some View {
        if let s = stats, let lo = s.low52, let hi = s.high52, let px = s.price, hi > lo {
            DossierSection(
                title: "The past year",
                note: "Where it sits in its own 52-week range — near the top isn't 'expensive' and near the bottom isn't 'cheap', but it tells you what the last year felt like."
            ) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    RangeBar(low: lo, high: hi, value: px, symbol: symbol,
                             lowLabel: "52-week low", highLabel: "52-week high")
                    HStack(spacing: TarsTheme.Space.m) {
                        if let r = s.return1M {
                            DossierStat(label: "1 month", value: pct(r), tone: TarsTheme.pnl(r))
                        }
                        if let r = s.return1Y {
                            DossierStat(label: "1 year", value: pct(r), tone: TarsTheme.pnl(r))
                        }
                    }
                }
            }
        }
    }

    // MARK: Liquidity — how easily you could get in and out

    @ViewBuilder private var liquiditySection: some View {
        let hasAny = stats?.volume != nil || stats?.bid != nil
        if let s = stats, hasAny {
            DossierSection(
                title: "Liquidity",
                note: "The spread is what it costs to change your mind instantly. A thin market has a wide one."
            ) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    HStack(spacing: TarsTheme.Space.m) {
                        if let b = s.bid { DossierStat(label: "Bid", value: SymbolDisplay.price(symbol, b)) }
                        if let a = s.ask { DossierStat(label: "Ask", value: SymbolDisplay.price(symbol, a)) }
                        if let b = s.bid, let a = s.ask, a > b, let px = s.price, px > 0 {
                            DossierStat(label: "Spread", value: String(format: "%.3f%%", (a - b) / px * 100))
                        }
                    }
                    if let v = s.volume {
                        HStack(spacing: TarsTheme.Space.m) {
                            DossierStat(label: "Volume", value: compact(v))
                            if let av = s.avgVolume, av > 0 {
                                DossierStat(label: "vs average",
                                            value: String(format: "%.1f×", v / av),
                                            tone: v / av > 1.5 ? TarsTheme.accent : nil)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: Kind-specific chapters

    private var futuresSection: some View {
        let body = SymbolDisplay.pretty(symbol)   // "ES U6"
        return DossierSection(
            title: "The contract",
            note: "A futures contract expires. Before its last trading day you either close it or roll it into the next month — the desk will not deliver barrels of oil to your door."
        ) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                HStack(spacing: TarsTheme.Space.m) {
                    DossierStat(label: "Contract", value: body)
                    DossierStat(label: "Month", value: Self.monthName(symbol))
                }
                if let m = futuresMargin {
                    Divider().overlay(TarsTheme.hairline)
                    HStack(spacing: TarsTheme.Space.m) {
                        DossierStat(label: "Margin for 1",
                                    value: m.delta.formatted(.currency(code: "USD").precision(.fractionLength(0))),
                                    tone: TarsTheme.accent)
                        if m.creditVsNaive > 0 {
                            DossierStat(label: "Hedge credit",
                                        value: "−" + m.creditVsNaive.formatted(.currency(code: "USD").precision(.fractionLength(0))),
                                        tone: TarsTheme.gain)
                        }
                    }
                    Text(m.creditVsNaive > 0
                         ? "Your existing book offsets part of this contract's risk, so it costs less to margin than it would alone."
                         : "You post this as a good-faith deposit — not a payment. Profit and loss settle in cash every day.")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    /// "FUT:ESU6" → "September 2026". The letter IS the month, by convention.
    static let monthCodes: [Character: String] = [
        "F": "January", "G": "February", "H": "March", "J": "April",
        "K": "May", "M": "June", "N": "July", "Q": "August",
        "U": "September", "V": "October", "X": "November", "Z": "December",
    ]

    static func monthName(_ symbol: String) -> String {
        let body = symbol.uppercased().replacingOccurrences(of: "FUT:", with: "")
        guard body.count >= 2 else { return "—" }
        let code = body[body.index(body.endIndex, offsetBy: -2)]
        let yearDigit = body.suffix(1)
        guard let month = monthCodes[code] else { return "—" }
        return "\(month) 202\(yearDigit)"
    }

    private var fxSection: some View {
        let pair = SymbolDisplay.pretty(symbol)
        let parts = pair.split(separator: "/")
        return DossierSection(
            title: "The pair",
            note: "Marked at daily ECB reference rates. Your profit and loss converts back to dollars at those same rates, so the currency you're quoted in never quietly becomes a second bet."
        ) {
            HStack(spacing: TarsTheme.Space.m) {
                DossierStat(label: "You're buying", value: parts.first.map(String.init) ?? "—")
                DossierStat(label: "You're paying in", value: parts.last.map(String.init) ?? "—")
                DossierStat(label: "Moves in", value: "Pips")
            }
        }
    }

    private var cryptoSection: some View {
        DossierSection(
            title: "Around the clock",
            note: "Crypto never closes — no opening bell, no weekend gap, and no circuit breakers to pause a fall. Fills carry a 25 basis-point commission, already priced into the numbers you see."
        ) {
            HStack(spacing: TarsTheme.Space.m) {
                DossierStat(label: "Hours", value: "24 / 7")
                DossierStat(label: "Commission", value: "0.25%")
                DossierStat(label: "Halts", value: "None")
            }
        }
    }

    // MARK: Formatting

    private func pct(_ v: Double) -> String {
        String(format: "%@%.1f%%", v >= 0 ? "+" : "", v * 100)
    }

    private func compact(_ v: Double) -> String {
        switch v {
        case 1_000_000_000...: String(format: "%.1fB", v / 1_000_000_000)
        case 1_000_000...: String(format: "%.1fM", v / 1_000_000)
        case 1_000...: String(format: "%.0fK", v / 1_000)
        default: String(format: "%.0f", v)
        }
    }
}
