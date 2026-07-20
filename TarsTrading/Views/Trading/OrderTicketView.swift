import SwiftUI

/// THE cinematic order ticket. Works as `.sheet` content or as an inline panel.
/// Builds an `OrderDraft` and submits through the store; every state (idle,
/// submitting, filled, error) is designed.
struct OrderTicketView: View {
    let symbol: String
    var side: OrderSide = .buy

    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var chosenSide: OrderSide = .buy
    @State private var didSeedSide = false
    @State private var orderType: OrderType = .market
    @State private var tif: TimeInForce = .day
    @State private var qty: Double = 1
    @State private var limitPrice: Double = 0
    @State private var stopPrice: Double = 0
    @State private var trailPercent: Double = 5
    @State private var bracketExpanded = false
    @State private var takeProfit: Double = 0
    @State private var stopLoss: Double = 0
    @State private var phase: TicketPhase = .idle

    private var assetClass: AssetClass { symbol.contains("/") ? .crypto : .usEquity }
    private var currentPrice: Double { store.quote(for: symbol)?.price ?? 0 }

    /// Price used for cost estimation, by order type.
    private var effectivePrice: Double {
        switch orderType {
        case .market, .trailingStop: currentPrice
        case .limit, .stopLimit: limitPrice > 0 ? limitPrice : currentPrice
        case .stop: stopPrice > 0 ? stopPrice : currentPrice
        }
    }

    private var estimatedCost: Double { qty * effectivePrice }

    private var buyingPowerFraction: Double {
        guard store.account.buyingPower > 0 else { return 0 }
        return estimatedCost / store.account.buyingPower
    }

    private var blockedByBuyingPower: Bool {
        chosenSide == .buy && buyingPowerFraction > 1.0
    }

    private var fieldsValid: Bool {
        guard qty > 0, effectivePrice > 0 else { return false }
        switch orderType {
        case .market: return true
        case .limit: return limitPrice > 0
        case .stop: return stopPrice > 0
        case .stopLimit: return limitPrice > 0 && stopPrice > 0
        case .trailingStop: return trailPercent > 0
        }
    }

    private var canSubmit: Bool { fieldsValid && !blockedByBuyingPower }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                header
                TicketSideToggle(side: $chosenSide)
                typeAndTIF
                conditionalPriceFields
                quantitySection
                TicketBracketSection(
                    expanded: $bracketExpanded,
                    takeProfit: $takeProfit,
                    stopLoss: $stopLoss,
                    entryPrice: effectivePrice,
                    qty: qty,
                    side: chosenSide)
                costSection
                confirmArea
            }
            .padding(TarsTheme.Space.xl)
        }
        .background(TarsTheme.bg1)
        .scrollDismissesKeyboard(.interactively)
        .onAppear {
            if !didSeedSide { chosenSide = side; didSeedSide = true }
            seedPrices()
        }
        .onChange(of: orderType) { seedPrices() }
        .animation(Motion.snappy, value: orderType)
        .animation(Motion.snappy, value: chosenSide)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(symbol)
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .layoutPriority(1)
                Text(assetClass.label)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
            if let quote = store.quote(for: symbol) {
                VStack(alignment: .trailing, spacing: TarsTheme.Space.xs) {
                    TickerText(value: quote.price, font: TarsTheme.Text.priceHero)
                    PercentText(value: quote.changePercent)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(symbol) price \(quote.price, format: .currency(code: "USD"))")
            } else {
                VStack(alignment: .trailing, spacing: TarsTheme.Space.s) {
                    SkeletonBlock(width: 140, height: 32)
                    SkeletonBlock(width: 70, height: 12)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading \(symbol) price")
            }
        }
    }

    // MARK: Type + TIF

    private var typeAndTIF: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TicketSectionLabel("Order type")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: TarsTheme.Space.s) {
                    ForEach(OrderType.allCases) { type in
                        TicketChip(
                            title: type.label,
                            isSelected: orderType == type,
                            tint: TarsTheme.accent
                        ) {
                            Haptics.tick()
                            withAnimation(Motion.snappy) { orderType = type }
                        }
                        .accessibilityLabel("\(type.label) order type")
                        .accessibilityAddTraits(orderType == type ? .isSelected : [])
                    }
                }
            }
            HStack(spacing: TarsTheme.Space.s) {
                TicketSectionLabel("Time in force")
                Spacer()
                ForEach(TimeInForce.allCases) { t in
                    TicketChip(
                        title: t.label,
                        isSelected: tif == t,
                        tint: TarsTheme.accent
                    ) {
                        Haptics.tick()
                        withAnimation(Motion.snappy) { tif = t }
                    }
                    .accessibilityLabel(t == .day ? "Day order" : "Good til canceled")
                    .accessibilityAddTraits(tif == t ? .isSelected : [])
                }
            }
        }
    }

    // MARK: Conditional price fields

    private var conditionalPriceFields: some View {
        VStack(spacing: TarsTheme.Space.m) {
            if orderType == .limit || orderType == .stopLimit {
                TicketPriceField(label: "Limit price", value: $limitPrice)
                    .transition(fieldTransition)
            }
            if orderType == .stop || orderType == .stopLimit {
                TicketPriceField(label: "Stop price", value: $stopPrice)
                    .transition(fieldTransition)
            }
            if orderType == .trailingStop {
                TicketPercentField(label: "Trail", value: $trailPercent)
                    .transition(fieldTransition)
            }
        }
    }

    private var fieldTransition: AnyTransition {
        .asymmetric(
            insertion: .move(edge: .top).combined(with: .opacity),
            removal: .opacity)
    }

    // MARK: Quantity

    private var quantitySection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TicketSectionLabel("Quantity")
            HStack(alignment: .center, spacing: TarsTheme.Space.l) {
                TicketStepButton(systemName: "minus", enabled: qty > 1) {
                    Haptics.tick()
                    withAnimation(Motion.snappy) { qty = max(1, qty - 1) }
                }
                .accessibilityLabel("Decrease quantity")

                Text(qty, format: .number.precision(.fractionLength(0...4)))
                    .font(TarsTheme.Text.priceHero)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText(value: qty))
                    .animation(Motion.ticker, value: qty)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("Quantity \(qty, format: .number)")

                TicketStepButton(systemName: "plus", enabled: true) {
                    Haptics.tick()
                    withAnimation(Motion.snappy) { qty += 1 }
                }
                .accessibilityLabel("Increase quantity")
            }
            TicketDetentSlider(qty: $qty)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    // MARK: Cost & capacity

    private var costSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack {
                Text(chosenSide == .buy ? "Est. cost" : "Est. value")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text(estimatedCost, format: .currency(code: "USD"))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .contentTransition(.numericText(value: estimatedCost))
                    .animation(Motion.ticker, value: estimatedCost)
            }
            if chosenSide == .buy {
                TicketCapacityBar(fraction: buyingPowerFraction)
                HStack {
                    Text("Buying power")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Spacer()
                    Text(store.account.buyingPower, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                if blockedByBuyingPower {
                    Label {
                        Text("This order exceeds your buying power. Reduce quantity to continue.")
                            .font(TarsTheme.Text.caption)
                    } icon: {
                        Image(systemName: "hand.raised.fill")
                    }
                    .foregroundStyle(TarsTheme.loss)
                    .transition(.opacity)
                } else if buyingPowerFraction > 0.5 {
                    Label {
                        Text("Uses \(buyingPowerFraction, format: .percent.precision(.fractionLength(0))) of buying power — sizable for one position.")
                            .font(TarsTheme.Text.caption)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle.fill")
                    }
                    .foregroundStyle(TarsTheme.warning)
                    .transition(.opacity)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .animation(Motion.snappy, value: blockedByBuyingPower)
        .animation(Motion.snappy, value: buyingPowerFraction > 0.5)
    }

    // MARK: Confirm area (idle → submitting → filled / error)

    @ViewBuilder
    private var confirmArea: some View {
        switch phase {
        case .idle:
            TicketSlideToConfirm(
                side: chosenSide,
                symbol: symbol,
                enabled: canSubmit,
                badgeText: store.mode.badgeText,
                reduceMotion: reduceMotion,
                onConfirm: submitOrder)
        case .submitting:
            TicketSubmittingView()
                .transition(.opacity)
        case .filled(let order):
            TicketFilledView(order: order, reduceMotion: reduceMotion) {
                withAnimation(Motion.snappy) { phase = .idle }
            }
            .transition(.scale(scale: 0.92).combined(with: .opacity))
        case .error(let error):
            TicketErrorView(error: error) {
                withAnimation(Motion.snappy) { phase = .idle }
            }
            .transition(.opacity)
        }
    }

    // MARK: Actions

    private func seedPrices() {
        guard currentPrice > 0 else { return }
        if limitPrice == 0 { limitPrice = currentPrice }
        if stopPrice == 0 { stopPrice = currentPrice }
    }

    private func buildDraft() -> OrderDraft {
        var draft = OrderDraft(symbol: symbol)
        draft.assetClass = assetClass
        draft.side = chosenSide
        draft.type = orderType
        draft.qty = qty
        draft.timeInForce = tif
        switch orderType {
        case .market: break
        case .limit: draft.limitPrice = limitPrice
        case .stop: draft.stopPrice = stopPrice
        case .stopLimit:
            draft.limitPrice = limitPrice
            draft.stopPrice = stopPrice
        case .trailingStop: draft.trailPercent = trailPercent
        }
        if takeProfit > 0 || stopLoss > 0 {
            draft.bracket = BracketLevels(
                takeProfit: takeProfit > 0 ? takeProfit : nil,
                stopLoss: stopLoss > 0 ? stopLoss : nil)
        }
        return draft
    }

    private func submitOrder() {
        guard canSubmit, phase == .idle else { return }
        let draft = buildDraft()
        withAnimation(Motion.snappy) { phase = .submitting }
        Task {
            do {
                let order = try await store.submit(draft)
                Haptics.fill()
                withAnimation(Motion.fluid) { phase = .filled(order) }
            } catch let error as TarsError {
                Haptics.failure()
                withAnimation(Motion.snappy) { phase = .error(error) }
            } catch {
                Haptics.failure()
                withAnimation(Motion.snappy) {
                    phase = .error(.network(error.localizedDescription))
                }
            }
        }
    }
}

// MARK: - Phase

fileprivate enum TicketPhase: Equatable {
    case idle
    case submitting
    case filled(Order)
    case error(TarsError)
}

// MARK: - Section label

fileprivate struct TicketSectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(1.1)
            .foregroundStyle(TarsTheme.inkTertiary)
    }
}

// MARK: - Side toggle (Buy / Sell capsule with color morph)

fileprivate struct TicketSideToggle: View {
    @Binding var side: OrderSide
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 0) {
            ForEach(OrderSide.allCases) { s in
                Button {
                    guard side != s else { return }
                    Haptics.tap()
                    withAnimation(Motion.snappy) { side = s }
                } label: {
                    Text(s.label)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(side == s ? TarsTheme.bg0 : TarsTheme.inkSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, TarsTheme.Space.m)
                        .background {
                            if side == s {
                                Capsule(style: .continuous)
                                    .fill(s == .buy ? TarsTheme.gain : TarsTheme.loss)
                                    .matchedGeometryEffect(id: "sidePill", in: ns)
                            }
                        }
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("\(s.label) side")
                .accessibilityAddTraits(side == s ? .isSelected : [])
            }
        }
        .padding(TarsTheme.Space.xs)
        .background(
            Capsule(style: .continuous)
                .fill(TarsTheme.bg2)
                .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
    }
}

// MARK: - Selectable chip

fileprivate struct TicketChip: View {
    let title: String
    let isSelected: Bool
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(isSelected ? TarsTheme.bg0 : TarsTheme.inkSecondary)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(
                    Capsule(style: .continuous)
                        .fill(isSelected ? tint : TarsTheme.bg3)
                )
        }
        .buttonStyle(PressableStyle())
    }
}

// MARK: - Price / percent fields

fileprivate struct TicketPriceField: View {
    let label: String
    @Binding var value: Double

    var body: some View {
        HStack {
            Text(label)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            Spacer()
            TextField(label, value: $value, format: .currency(code: "USD"))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(TarsTheme.Text.price)
                .foregroundStyle(TarsTheme.inkPrimary)
                .frame(maxWidth: 160)
                .accessibilityLabel(label)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }
}

fileprivate struct TicketPercentField: View {
    let label: String
    @Binding var value: Double

    var body: some View {
        HStack {
            Text(label)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            Spacer()
            TextField(label, value: $value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(TarsTheme.Text.price)
                .foregroundStyle(TarsTheme.inkPrimary)
                .frame(maxWidth: 100)
                .accessibilityLabel("\(label) percent")
            Text("%")
                .font(TarsTheme.Text.price)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }
}

// MARK: - Stepper button

fileprivate struct TicketStepButton: View {
    let systemName: String
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(enabled ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                .frame(width: 44, height: 44)
                .background(
                    Circle()
                        .fill(TarsTheme.bg3)
                        .overlay(Circle().strokeBorder(TarsTheme.hairline, lineWidth: 1))
                )
        }
        .buttonStyle(PressableStyle())
        .disabled(!enabled)
    }
}

// MARK: - Detent slider (drag across 1 / 5 / 10 / 25 / 50 / 100)

fileprivate struct TicketDetentSlider: View {
    @Binding var qty: Double
    private static let detents: [Double] = [1, 5, 10, 25, 50, 100]

    private var selectedIndex: Int? {
        Self.detents.firstIndex(of: qty)
    }

    /// Highest detent at or below the current qty — drives the fill.
    private var fillIndex: Int {
        Self.detents.lastIndex(where: { $0 <= qty }) ?? 0
    }

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let count = Self.detents.count
            let step = width / CGFloat(count - 1)

            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(TarsTheme.bg3)
                    .frame(height: 6)
                Capsule(style: .continuous)
                    .fill(TarsTheme.accent)
                    .frame(width: max(6, step * CGFloat(fillIndex)), height: 6)
                    .animation(Motion.snappy, value: fillIndex)

                ForEach(Array(Self.detents.enumerated()), id: \.offset) { i, detent in
                    VStack(spacing: TarsTheme.Space.s) {
                        Circle()
                            .fill(i <= fillIndex ? TarsTheme.accent : TarsTheme.bg3)
                            .overlay(Circle().strokeBorder(TarsTheme.hairline, lineWidth: 1))
                            .frame(width: selectedIndex == i ? 18 : 12,
                                   height: selectedIndex == i ? 18 : 12)
                            .animation(Motion.snappy, value: selectedIndex)
                        Text(detent, format: .number)
                            .font(TarsTheme.Text.micro)
                            .monospacedDigit()
                            .foregroundStyle(selectedIndex == i ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                    }
                    .frame(width: 40)
                    // Places the dot's center on the track line (VStack center
                    // sits ~10pt below the dot's center).
                    .position(x: step * CGFloat(i), y: 22 + 10)
                }
            }
            .frame(height: 44)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        let fraction = min(max(drag.location.x / width, 0), 1)
                        let index = Int((fraction * CGFloat(count - 1)).rounded())
                        let detent = Self.detents[index]
                        if detent != qty {
                            Haptics.tick()
                            withAnimation(Motion.snappy) { qty = detent }
                        }
                    }
            )
        }
        .frame(height: 56)
        .padding(.horizontal, TarsTheme.Space.m)
        .accessibilityElement()
        .accessibilityLabel("Quantity presets")
        .accessibilityValue("\(qty, format: .number)")
        .accessibilityHint("Swipe up or down to move between preset quantities.")
        .accessibilityAdjustableAction { direction in
            let i = fillIndex
            switch direction {
            case .increment where i < Self.detents.count - 1: qty = Self.detents[i + 1]
            case .decrement where i > 0: qty = Self.detents[i - 1]
            default: break
            }
        }
    }
}

// MARK: - Capacity bar (% of buying power)

fileprivate struct TicketCapacityBar: View {
    let fraction: Double

    private var barColor: Color {
        if fraction > 1.0 { TarsTheme.loss }
        else if fraction > 0.5 { TarsTheme.warning }
        else { TarsTheme.accent }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(TarsTheme.bg3)
                    Capsule(style: .continuous)
                        .fill(barColor)
                        .frame(width: max(0, geo.size.width * min(fraction, 1)))
                        .animation(Motion.ticker, value: fraction)
                }
            }
            .frame(height: 8)
            Text(fraction, format: .percent.precision(.fractionLength(0)))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(barColor)
                .contentTransition(.numericText(value: fraction))
                .animation(Motion.ticker, value: fraction)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Uses \(fraction, format: .percent.precision(.fractionLength(0))) of buying power")
    }
}

// MARK: - Bracket section (take-profit / stop-loss + R:R)

fileprivate struct TicketBracketSection: View {
    @Binding var expanded: Bool
    @Binding var takeProfit: Double
    @Binding var stopLoss: Double
    let entryPrice: Double
    let qty: Double
    let side: OrderSide

    /// Dollar risk to the stop; positive when the stop is on the losing side.
    private var risk: Double? {
        guard stopLoss > 0, entryPrice > 0 else { return nil }
        let perShare = side == .buy ? entryPrice - stopLoss : stopLoss - entryPrice
        guard perShare > 0 else { return nil }
        return perShare * qty
    }

    /// Dollar reward to the target; positive when the target is on the winning side.
    private var reward: Double? {
        guard takeProfit > 0, entryPrice > 0 else { return nil }
        let perShare = side == .buy ? takeProfit - entryPrice : entryPrice - takeProfit
        guard perShare > 0 else { return nil }
        return perShare * qty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Button {
                Haptics.tap()
                withAnimation(Motion.snappy) { expanded.toggle() }
            } label: {
                HStack {
                    Text("Bracket — exit plan")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel(expanded ? "Collapse bracket section" : "Expand bracket section")

            if expanded {
                VStack(spacing: TarsTheme.Space.m) {
                    TicketPriceField(label: "Take profit", value: $takeProfit)
                    TicketPriceField(label: "Stop loss", value: $stopLoss)
                    riskRewardReadout
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .top).combined(with: .opacity),
                    removal: .opacity))
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    @ViewBuilder
    private var riskRewardReadout: some View {
        if let risk, let reward {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "scalemass")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Group {
                    Text("Risk ")
                        .foregroundStyle(TarsTheme.inkSecondary)
                    + Text(risk, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .foregroundStyle(TarsTheme.loss)
                    + Text(" to make ")
                        .foregroundStyle(TarsTheme.inkSecondary)
                    + Text(reward, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .foregroundStyle(TarsTheme.gain)
                }
                .font(TarsTheme.Text.caption)
                .monospacedDigit()
                Spacer()
                Text("1 : \(reward / max(risk, 0.01), format: .number.precision(.fractionLength(1)))")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            .accessibilityElement(children: .combine)
        } else if takeProfit > 0 || stopLoss > 0 {
            Text("Set both levels on the correct side of entry to see risk vs. reward.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }
}

// MARK: - Slide to confirm

fileprivate struct TicketSlideToConfirm: View {
    let side: OrderSide
    let symbol: String
    let enabled: Bool
    let badgeText: String
    let reduceMotion: Bool
    let onConfirm: () -> Void

    @State private var dragX: CGFloat = 0
    @State private var completed = false
    @State private var hintPhase: CGFloat = 0

    private let knobSize: CGFloat = 52
    private let trackHeight: CGFloat = 60

    private var tint: Color { side == .buy ? TarsTheme.gain : TarsTheme.loss }

    var body: some View {
        VStack(spacing: TarsTheme.Space.s) {
            GeometryReader { geo in
                let travel = geo.size.width - knobSize - 8
                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(TarsTheme.bg2)
                        .overlay(
                            Capsule(style: .continuous)
                                .strokeBorder(enabled ? tint.opacity(0.5) : TarsTheme.hairline, lineWidth: 1)
                        )

                    // Progress tint behind the knob.
                    Capsule(style: .continuous)
                        .fill(tint.opacity(0.22))
                        .frame(width: knobSize + 8 + dragX)

                    // Label + PAPER stamp, fading as the knob advances.
                    HStack(spacing: TarsTheme.Space.s) {
                        Spacer()
                        Text("Slide to \(side.label.lowercased()) \(symbol)")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(enabled ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Text(badgeText)
                            .font(TarsTheme.Text.micro)
                            .kerning(1.2)
                            .foregroundStyle(TarsTheme.bg0)
                            .padding(.horizontal, TarsTheme.Space.s)
                            .padding(.vertical, TarsTheme.Space.xs)
                            .background(Capsule(style: .continuous).fill(TarsTheme.paperBadge))
                        Spacer()
                    }
                    .opacity(1 - Double(dragX / max(travel, 1)) * 1.6)

                    // Knob.
                    Circle()
                        .fill(enabled ? tint : TarsTheme.bg3)
                        .frame(width: knobSize, height: knobSize)
                        .overlay(
                            Image(systemName: completed ? "checkmark" : "arrow.right")
                                .font(TarsTheme.Text.heading)
                                .foregroundStyle(enabled ? TarsTheme.bg0 : TarsTheme.inkTertiary)
                                .offset(x: reduceMotion || completed || !enabled ? 0 : hintPhase)
                        )
                        .offset(x: 4 + dragX)
                        .gesture(
                            DragGesture()
                                .onChanged { drag in
                                    guard enabled, !completed else { return }
                                    dragX = min(max(0, drag.translation.width), travel)
                                }
                                .onEnded { _ in
                                    guard enabled, !completed else { return }
                                    if dragX > travel * 0.82 {
                                        completed = true
                                        withAnimation(Motion.snappy) { dragX = travel }
                                        Haptics.confirm()
                                        onConfirm()
                                    } else {
                                        withAnimation(Motion.fluid) { dragX = 0 }
                                    }
                                }
                        )
                }
            }
            .frame(height: trackHeight)
            .opacity(enabled ? 1 : 0.6)
            .accessibilityElement()
            .accessibilityLabel("Slide to \(side.label.lowercased()) \(symbol). \(badgeText) trading — no real money.")
            .accessibilityHint(enabled ? "Double tap to submit the order." : "Fix the highlighted issues first.")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction {
                guard enabled, !completed else { return }
                completed = true
                Haptics.confirm()
                onConfirm()
            }

            Text("Simulated fills. No real money moves.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .frame(maxWidth: .infinity)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                hintPhase = 5
            }
        }
    }
}

// MARK: - Submitting

fileprivate struct TicketSubmittingView: View {
    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            ProgressView()
                .tint(TarsTheme.accent)
            Text("Routing order…")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 60)
        .tarsPanel(elevation: 2)
        .accessibilityLabel("Submitting order")
    }
}

// MARK: - Filled (checkmark burst)

fileprivate struct TicketFilledView: View {
    let order: Order
    let reduceMotion: Bool
    let onDone: () -> Void

    @State private var burst = false

    private var isFilled: Bool { order.status == .filled }

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            ZStack {
                // One-shot celebratory rings — not a repeating effect.
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .strokeBorder(TarsTheme.gain.opacity(0.5 - Double(i) * 0.15), lineWidth: 2)
                        .frame(width: 56, height: 56)
                        .scaleEffect(burst ? 1.6 + CGFloat(i) * 0.45 : 0.6)
                        .opacity(burst ? 0 : 1)
                }
                Circle()
                    .fill(TarsTheme.gain)
                    .frame(width: 56, height: 56)
                    .scaleEffect(burst ? 1 : 0.4)
                Image(systemName: "checkmark")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.bg0)
                    .scaleEffect(burst ? 1 : 0.2)
            }
            .frame(height: 80)
            .accessibilityHidden(true)

            if isFilled, let price = order.filledAvgPrice {
                VStack(spacing: TarsTheme.Space.xs) {
                    Text("Filled")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    HStack(spacing: TarsTheme.Space.xs) {
                        Text("\(order.qty, format: .number) \(order.symbol) @")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.inkSecondary)
                        Text(price, format: .currency(code: "USD"))
                            .font(TarsTheme.Text.price)
                            .foregroundStyle(TarsTheme.inkPrimary)
                    }
                }
            } else {
                VStack(spacing: TarsTheme.Space.xs) {
                    Text("Order working")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("\(order.type.label) \(order.side.label.lowercased()) accepted — watching for a fill.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
            }

            Button(action: onDone) {
                Text("New order")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.accent)
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Start a new order")
        }
        .frame(maxWidth: .infinity)
        .padding(TarsTheme.Space.xl)
        .tarsPanel(elevation: 2)
        .onAppear {
            if reduceMotion {
                burst = true
            } else {
                withAnimation(Motion.molasses) { burst = true }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Error

fileprivate struct TicketErrorView: View {
    let error: TarsError
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "exclamationmark.octagon.fill")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.loss)
            Text("Order didn't go through")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(error.errorDescription ?? "Something went wrong.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Adjust & retry")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.xl)
                    .padding(.vertical, TarsTheme.Space.m)
                    .background(Capsule(style: .continuous).fill(TarsTheme.accent))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Adjust order and retry")
        }
        .frame(maxWidth: .infinity)
        .padding(TarsTheme.Space.xl)
        .tarsPanel(elevation: 2)
    }
}
