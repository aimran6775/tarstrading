import SwiftUI

// MARK: - JournalView

/// The trade journal: a day-grouped timeline of every fill, with the stats
/// that matter for discipline — not bragging. Win rate, realized P&L, and a
/// streak that rewards writing a thesis, not being right.
struct JournalView: View {
    @Environment(TradingStore.self) private var store
    @State private var filter: JournalFilter = .all
    @Namespace private var chipNamespace

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                header
                filterBar

                if store.isBootstrapping && store.journal.isEmpty {
                    loadingSkeleton
                } else if store.journal.isEmpty {
                    JournalEmptyState()
                        .frame(maxWidth: .infinity)
                        .padding(.top, TarsTheme.Space.xxl)
                } else if sections.isEmpty {
                    filteredEmptyState
                } else {
                    ForEach(sections) { section in
                        daySection(section)
                    }
                }
            }
            .padding(TarsTheme.Space.xl)
            .animation(Motion.spatial, value: filter)
            .animation(Motion.spatial, value: store.journal)
        }
        .background(TarsTheme.bg0)
        .scrollIndicators(.hidden)
    }

    // MARK: Derived data

    private var closedEntries: [JournalEntry] {
        store.journal.filter { $0.closedAt != nil }
    }

    private var winRate: Double? {
        let decided = closedEntries.compactMap(\.realizedPnL)
        guard !decided.isEmpty else { return nil }
        return Double(decided.filter { $0 > 0 }.count) / Double(decided.count)
    }

    private var totalRealizedPnL: Double {
        closedEntries.compactMap(\.realizedPnL).reduce(0, +)
    }

    /// Consecutive most-recent closed trades that carry a thesis. Journal is
    /// newest-first, so we walk from the top and stop at the first blank one.
    /// The streak is about honesty on paper, not about winning.
    private var disciplineStreak: Int {
        var streak = 0
        for entry in closedEntries {
            if entry.thesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { break }
            streak += 1
        }
        return streak
    }

    private var sections: [JournalDaySection] {
        let visible = store.journal.filter { filter.matches($0) }
        let grouped = Dictionary(grouping: visible) {
            Calendar.current.startOfDay(for: $0.closedAt ?? $0.openedAt)
        }
        return grouped.keys.sorted(by: >).map { day in
            JournalDaySection(id: day, entries: grouped[day] ?? [])
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            Text("Journal")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)

            HStack(spacing: TarsTheme.Space.m) {
                JournalStatTile(label: "Win rate") {
                    if let winRate {
                        Text(winRate, format: .percent.precision(.fractionLength(0)))
                            .foregroundStyle(TarsTheme.inkPrimary)
                    } else {
                        Text("—").foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .accessibilityLabel(winRateAccessibilityLabel)

                JournalStatTile(label: "Realized P&L") {
                    Text(totalRealizedPnL,
                         format: .currency(code: "USD").sign(strategy: .always(showZero: false)))
                        .foregroundStyle(TarsTheme.pnl(totalRealizedPnL))
                        .contentTransition(.numericText(value: totalRealizedPnL))
                }
                .accessibilityLabel("Total realized profit and loss, \(totalRealizedPnL.formatted(.currency(code: "USD")))")

                JournalStatTile(label: "Thesis streak") {
                    HStack(spacing: TarsTheme.Space.xs) {
                        Text("\(disciplineStreak)")
                            .foregroundStyle(disciplineStreak > 0 ? TarsTheme.accent : TarsTheme.inkTertiary)
                            .contentTransition(.numericText(value: Double(disciplineStreak)))
                        if disciplineStreak > 0 {
                            Image(systemName: "flame.fill")
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.accent)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .accessibilityLabel("Discipline streak: \(disciplineStreak) consecutive closed trades journaled with a thesis")
            }
        }
    }

    private var winRateAccessibilityLabel: String {
        if let winRate {
            "Win rate \(winRate.formatted(.percent.precision(.fractionLength(0)))) of closed trades"
        } else {
            "Win rate not available yet — no closed trades"
        }
    }

    // MARK: Filter chips

    private var filterBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(JournalFilter.allCases) { option in
                    Button {
                        Haptics.tick()
                        withAnimation(Motion.snappy) { filter = option }
                    } label: {
                        Text(option.label)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(filter == option ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                            .padding(.horizontal, TarsTheme.Space.l)
                            .padding(.vertical, TarsTheme.Space.s)
                            .background {
                                if filter == option {
                                    Capsule(style: .continuous)
                                        .fill(TarsTheme.bg3)
                                        .overlay(
                                            Capsule(style: .continuous)
                                                .strokeBorder(TarsTheme.accent.opacity(0.55), lineWidth: 1)
                                        )
                                        .matchedGeometryEffect(id: "journal.filter.pill", in: chipNamespace)
                                }
                            }
                            .contentShape(Capsule())
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Filter journal: \(option.label)")
                    .accessibilityAddTraits(filter == option ? [.isSelected] : [])
                }
            }
            .padding(.vertical, TarsTheme.Space.xs)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: Sections

    private func daySection(_ section: JournalDaySection) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text(journalDayLabel(section.id))
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .textCase(.uppercase)
                .kerning(1.1)
                .padding(.top, TarsTheme.Space.s)
                .accessibilityAddTraits(.isHeader)

            ForEach(section.entries) { entry in
                JournalEntryCard(entry: entry)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: Empty & loading states

    private var filteredEmptyState: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Nothing matches this filter")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text("Try a different lens on your trading history.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xxl)
    }

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            SkeletonBlock(width: 90, height: 12)
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                    HStack {
                        SkeletonBlock(width: 72, height: 18)
                        Spacer()
                        SkeletonBlock(width: 88, height: 18)
                    }
                    SkeletonBlock(width: 180, height: 12)
                    SkeletonBlock(height: 12)
                }
                .padding(TarsTheme.Space.l)
                .tarsPanel(elevation: 2)
            }
        }
        .accessibilityLabel("Loading journal")
    }
}

// MARK: - ThesisCaptureSheet

/// The 10-second honesty prompt shown right after a fill. One question, one
/// optional tag, done. Skipping is allowed — lying to yourself is not.
struct ThesisCaptureSheet: View {
    let entry: JournalEntry

    @Environment(TradingStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var thesis: String
    @State private var selectedTag: OutcomeTag?
    @FocusState private var thesisFocused: Bool

    init(entry: JournalEntry) {
        self.entry = entry
        _thesis = State(initialValue: entry.thesis)
        _selectedTag = State(initialValue: entry.outcomeTag)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                topRow
                symbolHeader
                thesisField
                if entry.closedAt != nil {
                    outcomePicker
                }
                actions
            }
            .padding(TarsTheme.Space.xl)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(TarsTheme.bg1)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(TarsTheme.bg1)
        .onAppear {
            // Small delay lets the sheet spring settle before the keyboard rises.
            Task {
                try? await Task.sleep(for: .milliseconds(350))
                thesisFocused = true
            }
        }
    }

    private var topRow: some View {
        HStack {
            Text(store.mode.badgeText)
                .font(TarsTheme.Text.micro)
                .kerning(1.2)
                .foregroundStyle(TarsTheme.paperBadge)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, TarsTheme.Space.xs)
                .background(
                    Capsule(style: .continuous)
                        .strokeBorder(TarsTheme.paperBadge.opacity(0.6), lineWidth: 1)
                )
                .accessibilityLabel("\(store.mode.badgeText) trading mode. No real money.")

            Spacer()

            if let pnl = entry.realizedPnL {
                JournalPnLChip(value: pnl)
            }
        }
    }

    private var symbolHeader: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Text(entry.symbol)
                .font(TarsTheme.Text.hero)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .accessibilityAddTraits(.isHeader)
            Text(journalFillSummary(entry))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
    }

    private var thesisField: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Why did you take this trade?")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)

            TextField("Breakout above resistance, earnings play, hedge…",
                      text: $thesis, axis: .vertical)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(3...6)
                .focused($thesisFocused)
                .padding(TarsTheme.Space.l)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .fill(TarsTheme.bg2)
                        .overlay(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                                .strokeBorder(thesisFocused ? TarsTheme.accent.opacity(0.55) : TarsTheme.hairline,
                                              lineWidth: 1)
                        )
                )
                .animation(Motion.snappy, value: thesisFocused)
                .accessibilityLabel("Trade thesis. Why did you take this trade?")
        }
    }

    private var outcomePicker: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("How did it go?")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .textCase(.uppercase)
                .kerning(1.1)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: TarsTheme.Space.s),
                                GridItem(.flexible(), spacing: TarsTheme.Space.s)],
                      spacing: TarsTheme.Space.s) {
                ForEach(OutcomeTag.allCases) { tag in
                    let isSelected = selectedTag == tag
                    Button {
                        Haptics.tick()
                        withAnimation(Motion.snappy) {
                            selectedTag = isSelected ? nil : tag
                        }
                    } label: {
                        Text(tag.rawValue)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(isSelected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .padding(.horizontal, TarsTheme.Space.s)
                            .background(
                                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                    .fill(isSelected ? TarsTheme.bg3 : TarsTheme.bg2)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                            .strokeBorder(isSelected ? TarsTheme.accent.opacity(0.6) : TarsTheme.hairline,
                                                          lineWidth: 1)
                                    )
                            )
                            .contentShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Outcome: \(tag.rawValue)")
                    .accessibilityAddTraits(isSelected ? [.isSelected] : [])
                }
            }
        }
    }

    private var actions: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Button(action: save) {
                Text("Save to journal")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.bg0)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                            .fill(TarsTheme.accent)
                    )
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Save thesis to journal")

            Button(action: skip) {
                Text("Skip")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(maxWidth: .infinity, minHeight: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Skip journaling this trade")
        }
        .padding(.top, TarsTheme.Space.s)
    }

    private func save() {
        var updated = entry
        updated.thesis = thesis.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.outcomeTag = selectedTag
        store.updateJournal(updated)
        Haptics.success()
        store.pendingThesisCapture = nil
        dismiss()
    }

    private func skip() {
        store.pendingThesisCapture = nil
        dismiss()
    }
}

// MARK: - Filter

fileprivate enum JournalFilter: CaseIterable, Identifiable {
    case all, wins, losses, untagged, agent

    var id: Self { self }

    var label: String {
        switch self {
        case .all: "All"
        case .wins: "Wins"
        case .losses: "Losses"
        case .untagged: "Untagged"
        case .agent: "Agent trades"
        }
    }

    func matches(_ entry: JournalEntry) -> Bool {
        switch self {
        case .all:
            true
        case .wins:
            (entry.realizedPnL ?? 0) > 0
        case .losses:
            (entry.realizedPnL ?? 0) < 0
        case .untagged:
            entry.thesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || (entry.closedAt != nil && entry.outcomeTag == nil)
        case .agent:
            entry.agentID != nil
        }
    }
}

fileprivate struct JournalDaySection: Identifiable {
    let id: Date
    let entries: [JournalEntry]
}

// MARK: - Entry card

fileprivate struct JournalEntryCard: View {
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Text(entry.symbol)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .layoutPriority(1)

                sideBadge

                if entry.agentID != nil {
                    agentBadge
                }

                Spacer()

                if let pnl = entry.realizedPnL {
                    JournalPnLChip(value: pnl)
                } else {
                    openChip
                }
            }

            Text(journalFillSummary(entry))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkSecondary)

            if entry.thesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("No thesis captured")
                    .font(TarsTheme.Text.body.italic())
                    .foregroundStyle(TarsTheme.inkTertiary)
            } else {
                Text(entry.thesis)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(4)
            }

            if let tag = entry.outcomeTag {
                Text(tag.rawValue)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .padding(.horizontal, TarsTheme.Space.m)
                    .padding(.vertical, TarsTheme.Space.xs)
                    .background(
                        Capsule(style: .continuous)
                            .fill(TarsTheme.bg3)
                            .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1))
                    )
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    private var sideBadge: some View {
        Text(entry.side.label.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(0.8)
            .foregroundStyle(TarsTheme.inkSecondary)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous)
                    .fill(TarsTheme.bg3)
            )
    }

    private var agentBadge: some View {
        Text("AGENT")
            .font(TarsTheme.Text.micro)
            .kerning(1.0)
            .foregroundStyle(TarsTheme.agentPurple)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous)
                    .strokeBorder(TarsTheme.agentPurple.opacity(0.55), lineWidth: 1)
            )
            .accessibilityLabel("Placed by an AI agent")
    }

    private var openChip: some View {
        Text("OPEN")
            .font(TarsTheme.Text.micro)
            .kerning(1.0)
            .foregroundStyle(TarsTheme.accent)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous)
                    .strokeBorder(TarsTheme.accent.opacity(0.5), lineWidth: 1)
            )
    }

    private var accessibilitySummary: String {
        var parts: [String] = [
            "\(entry.side.label) \(entry.qty.formatted(.number)) \(entry.symbol)"
        ]
        if let pnl = entry.realizedPnL {
            parts.append("realized \(pnl.formatted(.currency(code: "USD")))")
        } else {
            parts.append("position open")
        }
        if entry.agentID != nil { parts.append("placed by agent") }
        parts.append(entry.thesis.isEmpty ? "no thesis captured" : "thesis: \(entry.thesis)")
        if let tag = entry.outcomeTag { parts.append("tagged \(tag.rawValue)") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Shared chrome

fileprivate struct JournalPnLChip: View {
    let value: Double

    var body: some View {
        Text(value, format: .currency(code: "USD").sign(strategy: .always(showZero: false)))
            .font(TarsTheme.Text.priceSmall)
            .foregroundStyle(TarsTheme.pnl(value))
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous)
                    .fill(TarsTheme.pnl(value).opacity(0.12))
            )
            .accessibilityLabel("Realized profit and loss \(value.formatted(.currency(code: "USD")))")
    }
}

fileprivate struct JournalStatTile<Value: View>: View {
    let label: String
    @ViewBuilder var value: Value

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            value
                .font(TarsTheme.Text.price)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .textCase(.uppercase)
                .kerning(1.0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Empty state

fileprivate struct JournalEmptyState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            ZStack {
                Circle()
                    .fill(TarsTheme.tarsAurora)
                    .frame(width: 120, height: 120)
                Image(systemName: "text.book.closed")
                    .font(TarsTheme.Text.hero)
                    .foregroundStyle(TarsTheme.accent)
            }
            .scaleEffect(appeared || reduceMotion ? 1 : 0.85)
            .opacity(appeared || reduceMotion ? 1 : 0)

            Text("Your trading story starts with trade one.")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
                .multilineTextAlignment(.center)

            Text("Close a position and Tars will ask you why you took it.\nThe thesis matters more than the outcome.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(TarsTheme.Space.xxl)
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(Motion.grand) { appeared = true }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Journal is empty. Your trading story starts with trade one. Close a position and Tars will ask you why you took it.")
    }
}

// MARK: - Helpers

/// "12 @ $184.20 → $190.05" (exit omitted while open).
fileprivate func journalFillSummary(_ entry: JournalEntry) -> String {
    let qty = entry.qty.formatted(.number.precision(.fractionLength(0...4)))
    let entryPrice = entry.entryPrice.formatted(.currency(code: "USD"))
    if let exit = entry.exitPrice {
        return "\(qty) @ \(entryPrice) → \(exit.formatted(.currency(code: "USD")))"
    }
    return "\(qty) @ \(entryPrice)"
}

fileprivate func journalDayLabel(_ day: Date) -> String {
    if Calendar.current.isDateInToday(day) { return "Today" }
    if Calendar.current.isDateInYesterday(day) { return "Yesterday" }
    return day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
}
