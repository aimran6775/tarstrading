import SwiftUI

/// The multi-panel pro workspace. Three layout presets — Trade, Monitor,
/// Focus — recompose the same panels (chart, watchlist, positions, open
/// orders, order ticket) like a professional terminal. Preset and selected
/// symbol persist across launches.
struct WorkspaceView: View {
    @Environment(TradingStore.self) private var store
    @Environment(\.horizontalSizeClass) private var hSizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var selectedSymbol: String =
        UserDefaults.standard.string(forKey: WorkspaceDefaults.symbolKey) ?? "AAPL"
    @State private var preset: WorkspacePreset =
        WorkspacePreset(rawValue: UserDefaults.standard.string(forKey: WorkspaceDefaults.presetKey) ?? "")
        ?? .trade
    @State private var showingTicket = false

    var body: some View {
        Group {
            if hSizeClass == .compact {
                compactLayout
            } else {
                regularLayout
            }
        }
        .background(TarsTheme.bg0)
        .onChange(of: preset) { _, newValue in
            UserDefaults.standard.set(newValue.rawValue, forKey: WorkspaceDefaults.presetKey)
        }
        .onChange(of: selectedSymbol) { _, newValue in
            UserDefaults.standard.set(newValue, forKey: WorkspaceDefaults.symbolKey)
        }
        .sheet(isPresented: $showingTicket) {
            OrderTicketView(symbol: selectedSymbol, side: .buy)
                .id(selectedSymbol)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(TarsTheme.bg1)
        }
    }

    // MARK: - Regular (iPad) layout

    private var regularLayout: some View {
        GeometryReader { geo in
            let spacing = TarsTheme.Space.l
            let innerWidth = max(0, geo.size.width - spacing * 2)
            let leftWidth = preset == .focus
                ? innerWidth
                : max(0, (innerWidth - spacing) * preset.chartFraction)
            let bottomHeight = max(200, geo.size.height * 0.30)

            VStack(spacing: spacing) {
                headerBar
                HStack(alignment: .top, spacing: spacing) {
                    leftColumn(bottomHeight: bottomHeight)
                        .frame(width: leftWidth)
                    if preset != .focus {
                        rightColumn(bottomHeight: bottomHeight)
                            .frame(maxWidth: .infinity)
                            .transition(.move(edge: .trailing).combined(with: .opacity))
                    }
                }
                .frame(maxHeight: .infinity)
            }
            .padding(spacing)
        }
    }

    /// Chart lives here in every preset so it keeps identity while the
    /// layout morphs around it.
    private func leftColumn(bottomHeight: CGFloat) -> some View {
        VStack(spacing: TarsTheme.Space.l) {
            chartPanel
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if preset == .monitor {
                PositionsPanel()
                    .frame(height: bottomHeight)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    @ViewBuilder
    private func rightColumn(bottomHeight: CGFloat) -> some View {
        VStack(spacing: TarsTheme.Space.l) {
            WorkspaceWatchlist(selection: $selectedSymbol)
                .frame(maxHeight: .infinity)
            switch preset {
            case .trade:
                OrderTicketView(symbol: selectedSymbol, side: .buy)
                    .id(selectedSymbol)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            case .monitor:
                OpenOrdersPanel()
                    .frame(height: bottomHeight)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            case .focus:
                EmptyView()
            }
        }
    }

    // MARK: - Compact (iPhone / split) layout

    private var compactLayout: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.l) {
                headerBar
                chartPanel
                    .frame(height: preset == .focus ? 480 : 340)
                if preset != .focus {
                    WorkspaceWatchlist(selection: $selectedSymbol)
                        .frame(height: 300)
                }
                switch preset {
                case .trade:
                    OrderTicketView(symbol: selectedSymbol, side: .buy)
                        .id(selectedSymbol)
                case .monitor:
                    PositionsPanel()
                        .frame(minHeight: 240)
                    OpenOrdersPanel()
                        .frame(minHeight: 240)
                case .focus:
                    EmptyView()
                }
            }
            .padding(TarsTheme.Space.l)
        }
    }

    // MARK: - Header bar

    private var headerBar: some View {
        HStack(spacing: TarsTheme.Space.m) {
            WorkspacePresetPicker(selection: $preset, reduceMotion: reduceMotion)
            Spacer(minLength: TarsTheme.Space.s)
            WorkspaceModeStamp(text: store.mode.badgeText)
            if preset != .trade {
                Button {
                    Haptics.tap()
                    showingTicket = true
                } label: {
                    Label("New Order", systemImage: "plus")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.accent)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(
                            Capsule().fill(TarsTheme.accent.opacity(0.14))
                                .overlay(Capsule().strokeBorder(TarsTheme.accent.opacity(0.35), lineWidth: 1))
                        )
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("New order for \(selectedSymbol)")
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
    }

    // MARK: - Chart panel

    private var chartPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CHART")
                        .font(TarsTheme.Text.micro)
                        .tracking(1.2)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text(selectedSymbol)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.opacity)
                }
                Spacer()
                if let quote = store.quote(for: selectedSymbol) {
                    VStack(alignment: .trailing, spacing: 2) {
                        TickerText(value: quote.price,
                                   format: .currency(code: "USD").precision(.fractionLength(2)),
                                   font: TarsTheme.Text.price)
                        PercentText(value: quote.changePercent)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(selectedSymbol) quote")
                } else if store.isBootstrapping {
                    SkeletonBlock(width: 90, height: 18)
                }
            }
            .padding(TarsTheme.Space.l)
            .animation(Motion.snappy, value: selectedSymbol)

            ChartView(symbol: selectedSymbol)
                .id(selectedSymbol)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.bottom, TarsTheme.Space.s)
        }
        .tarsPanel()
    }
}

// MARK: - Layout presets

fileprivate enum WorkspacePreset: String, CaseIterable, Identifiable {
    case trade, monitor, focus
    var id: String { rawValue }
    var label: String {
        switch self {
        case .trade: "Trade"
        case .monitor: "Monitor"
        case .focus: "Focus"
        }
    }
    var icon: String {
        switch self {
        case .trade: "rectangle.split.2x1"
        case .monitor: "square.grid.2x2"
        case .focus: "rectangle"
        }
    }
    /// Share of horizontal space the chart column takes in regular width.
    var chartFraction: CGFloat {
        switch self {
        case .trade: 0.65
        case .monitor: 0.58
        case .focus: 1.0
        }
    }
}

fileprivate enum WorkspaceDefaults {
    static let presetKey = "workspace.preset"
    static let symbolKey = "workspace.selectedSymbol"
}

// MARK: - Preset picker (sliding-thumb segmented control)

fileprivate struct WorkspacePresetPicker: View {
    @Binding var selection: WorkspacePreset
    var reduceMotion: Bool
    @Namespace private var thumbNamespace

    var body: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            ForEach(WorkspacePreset.allCases) { preset in
                segment(preset)
            }
        }
        .padding(TarsTheme.Space.xs)
        .background(
            Capsule().fill(TarsTheme.bg1)
                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Workspace layout")
    }

    private func segment(_ preset: WorkspacePreset) -> some View {
        let isSelected = preset == selection
        return Button {
            guard !isSelected else { return }
            Haptics.tick()
            withAnimation(reduceMotion ? nil : Motion.fluid) {
                selection = preset
            }
        } label: {
            HStack(spacing: TarsTheme.Space.xs) {
                Image(systemName: preset.icon)
                    .font(TarsTheme.Text.micro)
                Text(preset.label)
                    .font(TarsTheme.Text.caption)
            }
            .foregroundStyle(isSelected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.s)
            .background {
                if isSelected {
                    Capsule()
                        .fill(TarsTheme.bg3)
                        .matchedGeometryEffect(id: "workspace.preset.thumb", in: thumbNamespace)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(preset.label) layout")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
    }
}

// MARK: - Mode stamp (paper-trading honesty)

fileprivate struct WorkspaceModeStamp: View {
    let text: String
    var body: some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .tracking(1.2)
            .foregroundStyle(TarsTheme.paperBadge)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule().fill(TarsTheme.paperBadge.opacity(0.12))
                    .overlay(Capsule().strokeBorder(TarsTheme.paperBadge.opacity(0.4), lineWidth: 1))
            )
            .accessibilityLabel("\(text) trading mode. No real money.")
    }
}

// MARK: - Compact workspace watchlist (selection drives the chart)

/// A tight, selection-aware watchlist owned by the workspace. Deliberately
/// separate from `WatchlistPanel` (which has no selection concept) so that
/// tapping a row retargets the chart without touching the Terminal module.
fileprivate struct WorkspaceWatchlist: View {
    @Environment(TradingStore.self) private var store
    @Binding var selection: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WorkspacePanelHeader(title: "Watchlist")

            if store.isBootstrapping {
                VStack(spacing: TarsTheme.Space.m) {
                    ForEach(0..<6, id: \.self) { _ in
                        HStack {
                            SkeletonBlock(width: 70)
                            Spacer()
                            SkeletonBlock(width: 90)
                        }
                    }
                }
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.l)
            } else if store.watchlist.isEmpty {
                VStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text("Nothing on watch")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Text("Symbols you add to your watchlist appear here.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(TarsTheme.Space.xl)
            } else {
                ScrollView {
                    LazyVStack(spacing: TarsTheme.Space.xs) {
                        ForEach(store.watchlist, id: \.self) { symbol in
                            WorkspaceWatchlistRow(symbol: symbol,
                                                  isSelected: symbol == selection) {
                                guard selection != symbol else { return }
                                Haptics.tick()
                                withAnimation(Motion.snappy) { selection = symbol }
                            }
                        }
                    }
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.bottom, TarsTheme.Space.s)
                }
            }
        }
        .tarsPanel()
    }
}

fileprivate struct WorkspaceWatchlistRow: View {
    @Environment(TradingStore.self) private var store
    let symbol: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        let quote = store.quote(for: symbol)
        Button(action: onSelect) {
            HStack(spacing: TarsTheme.Space.m) {
                RoundedRectangle(cornerRadius: TarsTheme.Radius.capsule)
                    .fill(isSelected ? TarsTheme.accent : Color.clear)
                    .frame(width: 3, height: 24)
                Text(symbol)
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(isSelected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                Spacer(minLength: TarsTheme.Space.s)
                if let quote {
                    TickerText(value: quote.price,
                               format: .currency(code: "USD").precision(.fractionLength(2)),
                               font: TarsTheme.Text.priceSmall)
                    PercentText(value: quote.changePercent, font: TarsTheme.Text.priceSmall)
                } else {
                    SkeletonBlock(width: 70, height: 12)
                }
            }
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.s)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(isSelected ? TarsTheme.bg3 : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
        }
        .buttonStyle(PressableStyle())
        .animation(Motion.snappy, value: isSelected)
        .accessibilityLabel("Show \(symbol) chart")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Shared panel header

fileprivate struct WorkspacePanelHeader: View {
    let title: String
    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(TarsTheme.Text.micro)
                .tracking(1.2)
                .foregroundStyle(TarsTheme.inkTertiary)
            Spacer()
        }
        .padding(TarsTheme.Space.l)
        .accessibilityAddTraits(.isHeader)
    }
}
