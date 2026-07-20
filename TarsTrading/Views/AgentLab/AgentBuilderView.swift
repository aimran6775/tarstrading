import SwiftUI

/// Sheet for creating or editing a `TradingAgent`. Every strategy the user can
/// express here is readable back in plain English — that's the product rule —
/// so each rule row shows its own live translation and the full thesis card
/// updates as you type.
public struct AgentBuilderView: View {
    @Environment(AgentLab.self) private var lab
    @Environment(\.dismiss) private var dismiss

    @State private var draft: TradingAgent
    private let original: TradingAgent?

    init(agent: TradingAgent?) {
        original = agent
        _draft = State(initialValue: agent ?? TradingAgent(
            name: "",
            universe: [],
            entry: [SignalRule(lhs: .sma(20), comparator: .crossesAbove, rhs: .indicator(.sma(50)))],
            exit: []))
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    identitySection
                    universeSection
                    entrySection
                    exitSection
                    thesisCard
                    riskPanel
                    validationFooter
                }
                .padding(TarsTheme.Space.l)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(TarsTheme.bg0)
            .navigationTitle(original == nil ? "New Agent" : "Edit Agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(isValid ? TarsTheme.accent : TarsTheme.inkTertiary)
                        .disabled(!isValid)
                }
            }
            .toolbarBackground(TarsTheme.bg1, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Identity

    private var identitySection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BuilderSectionHeader(title: "Identity",
                                 subtitle: "Name it something you won't be embarrassed to explain.")

            TextField("Agent name", text: $draft.name)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
                .padding(TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.bg3))
                .autocorrectionDisabled()

            HStack(spacing: TarsTheme.Space.s) {
                ForEach(Self.emojiOptions, id: \.self) { emoji in
                    Button {
                        Haptics.tick()
                        withAnimation(Motion.snappy) { draft.emoji = emoji }
                    } label: {
                        Text(emoji)
                            .font(TarsTheme.Text.title)
                            .frame(width: 44, height: 44)
                            .background(
                                Circle().fill(draft.emoji == emoji ? TarsTheme.bg3 : .clear))
                            .overlay(
                                Circle().strokeBorder(
                                    draft.emoji == emoji ? TarsTheme.accent : TarsTheme.hairline,
                                    lineWidth: draft.emoji == emoji ? 1.5 : 1))
                            .scaleEffect(draft.emoji == emoji ? 1.06 : 1)
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Emoji \(emoji)")
                    .accessibilityAddTraits(draft.emoji == emoji ? .isSelected : [])
                }
                Spacer(minLength: 0)
            }

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                HStack {
                    Text("Allocation")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Spacer()
                    Text(draft.allocation, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .contentTransition(.numericText(value: draft.allocation))
                        .animation(Motion.ticker, value: draft.allocation)
                }
                Slider(value: $draft.allocation, in: 1_000...50_000, step: 1_000)
                    .tint(TarsTheme.accent)
                    .onChange(of: draft.allocation) { _, _ in Haptics.tick() }
                    .accessibilityLabel("Allocation")
                    .accessibilityValue(
                        draft.allocation.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                Text("Paper capital only. It spends this, not your rent.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    // MARK: - Universe

    private var universeSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BuilderSectionHeader(title: "Universe",
                                 subtitle: "The only symbols this agent is allowed to touch.")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: TarsTheme.Space.s)],
                      spacing: TarsTheme.Space.s) {
                ForEach(DemoMarket.universe, id: \.symbol) { asset in
                    let selected = draft.universe.contains(asset.symbol)
                    Button {
                        Haptics.tick()
                        withAnimation(Motion.snappy) {
                            if selected {
                                draft.universe.removeAll { $0 == asset.symbol }
                            } else {
                                draft.universe.append(asset.symbol)
                            }
                        }
                    } label: {
                        Text(asset.symbol)
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(selected ? TarsTheme.accent : TarsTheme.inkSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .padding(.horizontal, TarsTheme.Space.xs)
                            .padding(.vertical, TarsTheme.Space.s)
                            .frame(maxWidth: .infinity)
                            .background(
                                Capsule().fill(selected ? TarsTheme.accent.opacity(0.14) : TarsTheme.bg2))
                            .overlay(
                                Capsule().strokeBorder(
                                    selected ? TarsTheme.accent.opacity(0.6) : TarsTheme.hairline,
                                    lineWidth: 1))
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            if draft.universe.isEmpty {
                Text("Pick at least one. An agent with nothing to trade is just a very quiet opinion.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.warning)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    // MARK: - Entry / Exit rules

    private var entrySection: some View {
        ruleSection(
            title: "Entry rules",
            subtitle: "ALL of these must be true at once before it buys.",
            rules: $draft.entry,
            joiner: "AND",
            maxRules: 3,
            emptyText: "No entry rules. The agent will buy nothing, forever. Admirably cautious; not a strategy.")
    }

    private var exitSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            ruleSection(
                title: "Exit rules",
                subtitle: "ANY one of these being true closes the position.",
                rules: $draft.exit,
                joiner: "OR",
                maxRules: 3,
                emptyText: "No exit rules yet. The stop-loss below would be the only way out.")

            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                OptionalPercentStepper(
                    title: "Stop-loss",
                    footnote: "Sells automatically if a position falls this far below its entry price.",
                    value: $draft.stopLossPercent,
                    defaultValue: 8, range: 1...50)
                Divider().overlay(TarsTheme.hairline)
                OptionalPercentStepper(
                    title: "Take-profit",
                    footnote: "Sells automatically once a position is up this much. Locks in gains; also caps them.",
                    value: $draft.takeProfitPercent,
                    defaultValue: 20, range: 1...200)
            }
            .padding(TarsTheme.Space.l)
            .tarsPanel()
        }
    }

    private func ruleSection(title: String, subtitle: String, rules: Binding<[SignalRule]>,
                             joiner: String, maxRules: Int, emptyText: String) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BuilderSectionHeader(title: title, subtitle: subtitle)

            if rules.wrappedValue.isEmpty {
                Text(emptyText)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(.vertical, TarsTheme.Space.s)
            }

            ForEach(rules) { $rule in
                VStack(alignment: .leading, spacing: 0) {
                    if let first = rules.wrappedValue.first, first.id != rule.id {
                        Text(joiner)
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.agentPurple)
                            .padding(.bottom, TarsTheme.Space.xs)
                    }
                    RuleEditorRow(rule: $rule) {
                        withAnimation(Motion.fluid) {
                            rules.wrappedValue.removeAll { $0.id == rule.id }
                        }
                        Haptics.tap()
                    }
                }
            }

            if rules.wrappedValue.count < maxRules {
                Button {
                    Haptics.tap()
                    withAnimation(Motion.fluid) {
                        rules.wrappedValue.append(
                            SignalRule(lhs: .rsi(14), comparator: .crossesBelow, rhs: .constant(30)))
                    }
                } label: {
                    Label("Add rule", systemImage: "plus.circle.fill")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.accent)
                }
                .buttonStyle(PressableStyle())
            } else {
                Text("Three rules is the ceiling. More conditions usually means more overfitting, not more edge.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    // MARK: - Thesis card

    private var thesisCard: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(TarsTheme.agentPurple)
                .frame(width: 3)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("The thesis, in plain English")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .textCase(.uppercase)
                Text(draft.entry.isEmpty ? "Add an entry rule and the strategy writes itself out here."
                                         : draft.thesisText)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .animation(Motion.fluid, value: draft.thesisText)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    // MARK: - Risk panel (always visible, never collapsible — by design)

    private var riskPanel: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "shield.lefthalf.filled")
                    .foregroundStyle(TarsTheme.loss)
                Text("Risk limits")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            Text("These are enforced by the runner and the backtester. There is no code path around them.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)

            RiskStepper(
                title: "Max position size",
                value: $draft.risk.maxPositionPercent,
                range: 5...100, step: 5, unit: "%",
                footnote: "No single position may use more than \(Int(draft.risk.maxPositionPercent))% of the agent's allocation.")
            Divider().overlay(TarsTheme.hairline)
            RiskStepper(
                title: "Max daily loss",
                value: $draft.risk.maxDailyLossPercent,
                range: 1...10, step: 0.5, unit: "%",
                footnote: "Trading halts for the rest of the day after losing \(draft.risk.maxDailyLossPercent.formatted(.number.precision(.fractionLength(0...1))))% of allocation in a day.")
            Divider().overlay(TarsTheme.hairline)
            RiskStepper(
                title: "Kill switch",
                value: $draft.risk.maxDrawdownPercent,
                range: 5...50, step: 1, unit: "%",
                footnote: "The agent is stopped permanently if it falls \(Int(draft.risk.maxDrawdownPercent))% from its peak. No appeals process.",
                emphasized: true)
            Divider().overlay(TarsTheme.hairline)
            RiskIntStepper(
                title: "Max open positions",
                value: $draft.risk.maxPositions,
                range: 1...10,
                footnote: "At most \(draft.risk.maxPositions) position\(draft.risk.maxPositions == 1 ? "" : "s") at the same time.")
        }
        .padding(TarsTheme.Space.l)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(TarsTheme.loss.opacity(0.35), lineWidth: 1)))
    }

    // MARK: - Validation

    private var validationReasons: [String] {
        var reasons: [String] = []
        if draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            reasons.append("Give the agent a name.")
        }
        if draft.entry.isEmpty { reasons.append("Add at least one entry rule.") }
        if draft.universe.isEmpty { reasons.append("Pick at least one symbol.") }
        return reasons
    }

    private var isValid: Bool { validationReasons.isEmpty }

    @ViewBuilder
    private var validationFooter: some View {
        if !validationReasons.isEmpty {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Before you can save")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .textCase(.uppercase)
                ForEach(validationReasons, id: \.self) { reason in
                    Label(reason, systemImage: "circle.dashed")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.warning)
                }
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
            .transition(.opacity)
        }
    }

    private func save() {
        guard isValid else { return }
        var agent = draft
        agent.name = agent.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if let original, rulesChanged(from: original), agent.status != .draft {
            agent.status = .draft
            agent.killedReason = nil
        }
        lab.upsert(agent)
        Haptics.confirm()
        dismiss()
    }

    private func rulesChanged(from original: TradingAgent) -> Bool {
        original.entry != draft.entry
            || original.exit != draft.exit
            || original.stopLossPercent != draft.stopLossPercent
            || original.takeProfitPercent != draft.takeProfitPercent
            || original.universe != draft.universe
            || original.risk != draft.risk
    }

    private static let emojiOptions = ["🤖", "🏄", "🎣", "🚀", "🦉", "🐢", "⚡️", "🧠"]
}

// MARK: - Section header

fileprivate struct BuilderSectionHeader: View {
    let title: String
    let subtitle: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(subtitle)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
    }
}

// MARK: - Indicator editing model

fileprivate enum IndicatorKind: String, CaseIterable, Identifiable {
    case price, sma, ema, rsi, highestHigh, lowestLow
    var id: String { rawValue }

    var label: String {
        switch self {
        case .price: "Price"
        case .sma: "SMA"
        case .ema: "EMA"
        case .rsi: "RSI"
        case .highestHigh: "Highest high"
        case .lowestLow: "Lowest low"
        }
    }

    var hasPeriod: Bool { self != .price }

    var defaultPeriod: Int {
        switch self {
        case .price: 0
        case .sma, .ema: 20
        case .rsi: 14
        case .highestHigh, .lowestLow: 50
        }
    }

    func indicator(period: Int) -> Indicator {
        switch self {
        case .price: .price
        case .sma: .sma(period)
        case .ema: .ema(period)
        case .rsi: .rsi(period)
        case .highestHigh: .highestHigh(period)
        case .lowestLow: .lowestLow(period)
        }
    }

    static func decompose(_ indicator: Indicator) -> (kind: IndicatorKind, period: Int) {
        switch indicator {
        case .price: (.price, 0)
        case .sma(let n): (.sma, n)
        case .ema(let n): (.ema, n)
        case .rsi(let n): (.rsi, n)
        case .highestHigh(let n): (.highestHigh, n)
        case .lowestLow(let n): (.lowestLow, n)
        }
    }
}

// MARK: - Indicator picker (kind menu + period stepper)

fileprivate struct IndicatorPicker: View {
    @Binding var indicator: Indicator

    private var kind: IndicatorKind { IndicatorKind.decompose(indicator).kind }
    private var period: Int { IndicatorKind.decompose(indicator).period }

    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Menu {
                ForEach(IndicatorKind.allCases) { option in
                    Button {
                        Haptics.tick()
                        indicator = option.indicator(period: option.hasPeriod
                            ? (kind.hasPeriod ? period : option.defaultPeriod)
                            : 0)
                    } label: {
                        if option == kind {
                            Label(option.label, systemImage: "checkmark")
                        } else {
                            Text(option.label)
                        }
                    }
                }
            } label: {
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(kind.label)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(Capsule().fill(TarsTheme.bg3))
            }
            .accessibilityLabel("Indicator, \(kind.label)")

            if kind.hasPeriod {
                Stepper(value: Binding(
                    get: { period },
                    set: { newPeriod in
                        Haptics.tick()
                        indicator = kind.indicator(period: newPeriod)
                    }), in: 2...200) {
                    Text("\(period)d")
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .fixedSize()
                .tint(TarsTheme.accent)
                .accessibilityLabel("Lookback period")
                .accessibilityValue("\(period) days")
            }
        }
    }
}

// MARK: - Rule editor row

fileprivate struct RuleEditorRow: View {
    @Binding var rule: SignalRule
    let onDelete: () -> Void

    private var rhsIsIndicator: Bool {
        if case .indicator = rule.rhs { return true }
        return false
    }

    private var rhsConstant: Binding<Double> {
        Binding(
            get: {
                if case .constant(let v) = rule.rhs { return v }
                return 0
            },
            set: { rule.rhs = .constant($0) })
    }

    private var rhsIndicator: Binding<Indicator> {
        Binding(
            get: {
                if case .indicator(let i) = rule.rhs { return i }
                return .sma(50)
            },
            set: { rule.rhs = .indicator($0) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            // Left-hand side
            HStack {
                Text("IF")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                IndicatorPicker(indicator: $rule.lhs)
                Spacer(minLength: 0)
                Button {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(TarsTheme.bg3))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Remove rule")
            }

            // Comparator
            Picker("Comparator", selection: $rule.comparator) {
                ForEach(Comparator.allCases, id: \.self) { comparator in
                    Text(comparator.plainEnglish).tag(comparator)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: rule.comparator) { _, _ in Haptics.tick() }

            // Right-hand side
            HStack(spacing: TarsTheme.Space.s) {
                Picker("Compare against", selection: Binding(
                    get: { rhsIsIndicator },
                    set: { wantsIndicator in
                        Haptics.tick()
                        withAnimation(Motion.snappy) {
                            rule.rhs = wantsIndicator ? .indicator(.sma(50)) : .constant(30)
                        }
                    })) {
                    Text("Indicator").tag(true)
                    Text("Value").tag(false)
                }
                .pickerStyle(.segmented)
                .fixedSize()

                if rhsIsIndicator {
                    IndicatorPicker(indicator: rhsIndicator)
                } else {
                    TextField("Value", value: rhsConstant,
                              format: .number.precision(.fractionLength(0...2)))
                        .keyboardType(.decimalPad)
                        .accessibilityLabel("Comparison value")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .multilineTextAlignment(.trailing)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, TarsTheme.Space.s)
                        .frame(maxWidth: 120)
                        .background(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .fill(TarsTheme.bg3))
                }
                Spacer(minLength: 0)
            }

            // Live plain-English preview
            Text(rule.plainEnglish)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.agentPurple)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.agentPurple.opacity(0.08)))
                .animation(Motion.snappy, value: rule.plainEnglish)
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg2)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1)))
    }
}

// MARK: - Optional percent stepper (stop-loss / take-profit)

fileprivate struct OptionalPercentStepper: View {
    let title: String
    let footnote: String
    @Binding var value: Double?
    let defaultValue: Double
    let range: ClosedRange<Double>

    private var isOn: Binding<Bool> {
        Binding(
            get: { value != nil },
            set: { on in
                Haptics.tick()
                withAnimation(Motion.snappy) { value = on ? defaultValue : nil }
            })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            HStack {
                Toggle(isOn: isOn) {
                    Text(title)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                .tint(TarsTheme.accent)
            }
            if let current = value {
                Stepper(value: Binding(
                    get: { current },
                    set: { newValue in
                        Haptics.tick()
                        value = newValue
                    }), in: range, step: 1) {
                    Text("\(Int(current))%")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText(value: current))
                        .animation(Motion.ticker, value: current)
                }
                .tint(TarsTheme.accent)
            }
            Text(footnote)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }
}

// MARK: - Risk steppers

fileprivate struct RiskStepper: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let unit: String
    let footnote: String
    var emphasized: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Stepper(value: $value, in: range, step: step) {
                HStack {
                    Text(title)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(emphasized ? TarsTheme.loss : TarsTheme.inkPrimary)
                    Spacer()
                    Text("\(value.formatted(.number.precision(.fractionLength(0...1))))\(unit)")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText(value: value))
                        .animation(Motion.ticker, value: value)
                }
            }
            .tint(emphasized ? TarsTheme.loss : TarsTheme.accent)
            .onChange(of: value) { _, _ in Haptics.tick() }
            Text(footnote)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }
}

fileprivate struct RiskIntStepper: View {
    let title: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    let footnote: String

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Stepper(value: $value, in: range) {
                HStack {
                    Text(title)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Spacer()
                    Text("\(value)")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText(value: Double(value)))
                        .animation(Motion.ticker, value: value)
                }
            }
            .tint(TarsTheme.accent)
            .onChange(of: value) { _, _ in Haptics.tick() }
            Text(footnote)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }
}
