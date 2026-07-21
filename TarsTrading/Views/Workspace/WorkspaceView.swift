import SwiftUI

/// The multi-panel pro workspace. In landscape, three layout presets — Trade,
/// Monitor, Focus — recompose the same panels (chart, watchlist, positions,
/// open orders, order ticket) like a professional terminal. In portrait the
/// chart becomes an edge-to-edge hero with a one-panel "deck" beneath it.
/// Preset and selected symbol persist across launches.
struct WorkspaceView: View {
    @Environment(TradingStore.self) private var store
    @Environment(TarsStore.self) private var tars
    @Environment(\.horizontalSizeClass) private var hSizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var selectedSymbol: String =
        UserDefaults.standard.string(forKey: WorkspaceDefaults.symbolKey) ?? "AAPL"
    @State private var preset: WorkspacePreset =
        WorkspacePreset(rawValue: UserDefaults.standard.string(forKey: WorkspaceDefaults.presetKey) ?? "")
        ?? .trade
    @State private var deck: WorkspaceDeck = .watchlist
    @State private var showingTicket = false
    @State private var inspectedSymbol: String?

    var body: some View {
        Group {
            if hSizeClass == .compact {
                compactLayout
            } else {
                regularLayout
            }
        }
        .background(TarsTheme.bg0)
        .background(keyboardLayer)
        .overlay { symbolHeroOverlay }
        .onChange(of: preset) { _, newValue in
            UserDefaults.standard.set(newValue.rawValue, forKey: WorkspaceDefaults.presetKey)
        }
        .onChange(of: selectedSymbol) { _, newValue in
            UserDefaults.standard.set(newValue, forKey: WorkspaceDefaults.symbolKey)
            tars.visibleSymbol = newValue
        }
        .onAppear { tars.visibleSymbol = selectedSymbol }
        .sheet(isPresented: $showingTicket) {
            OrderTicketView(symbol: selectedSymbol, side: .buy)
                .id(selectedSymbol)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(TarsTheme.bg1)
        }
    }

    // MARK: - Regular (iPad) layout

    /// Orientation is decided by the actual geometry, not the size class —
    /// a full-screen portrait iPad is still `.regular` horizontally.
    private var regularLayout: some View {
        GeometryReader { geo in
            if geo.size.height > geo.size.width {
                portraitLayout(size: geo.size)
            } else {
                landscapeLayout(size: geo.size)
            }
        }
    }

    // MARK: Landscape — 3-preset terminal

    private func landscapeLayout(size: CGSize) -> some View {
        let spacing = TarsTheme.Space.l
        let innerWidth = max(0, size.width - spacing * 2)
        let leftWidth = preset == .focus
            ? innerWidth
            : max(0, (innerWidth - spacing) * preset.chartFraction)
        let bottomHeight = max(200, size.height * 0.30)

        return VStack(spacing: spacing) {
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

    /// Chart lives here in every preset so it keeps identity while the
    /// layout morphs around it.
    private func leftColumn(bottomHeight: CGFloat) -> some View {
        VStack(spacing: TarsTheme.Space.l) {
            chartHero(showsStamp: false)
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
            WorkspaceWatchlist(selection: $selectedSymbol, onInspect: inspect)
                .frame(maxHeight: .infinity)
            switch preset {
            case .trade:
                OrderTicketView(symbol: selectedSymbol, side: .buy, style: .inline)
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

    // MARK: Portrait — hero chart + deck

    /// Taller than wide: the chart is an edge-to-edge hero (~55% of height,
    /// no card chrome, header floating on top of it), and everything else
    /// becomes a one-at-a-time deck below.
    private func portraitLayout(size: CGSize) -> some View {
        VStack(spacing: TarsTheme.Space.m) {
            chartHero(showsStamp: true)
                .frame(height: size.height * 0.55)
                .padding(.top, TarsTheme.Space.s)
            WorkspaceDeckPicker(selection: $deck, reduceMotion: reduceMotion)
                .padding(.horizontal, TarsTheme.Space.l)
            deckContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.l)
        }
    }

    @ViewBuilder
    private var deckContent: some View {
        switch deck {
        case .watchlist:
            WorkspaceWatchlist(selection: $selectedSymbol, onInspect: inspect)
                .transition(deckTransition)
        case .positions:
            PositionsPanel()
                .transition(deckTransition)
        case .orders:
            OpenOrdersPanel()
                .transition(deckTransition)
        case .ticket:
            OrderTicketView(symbol: selectedSymbol, side: .buy, style: .inline)
                .id(selectedSymbol)
                .transition(deckTransition)
        }
    }

    private var deckTransition: AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.98))
    }

    // MARK: - Compact (iPhone / split) layout

    private var compactLayout: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.l) {
                headerBar
                chartHero(showsStamp: false)
                    .frame(height: preset == .focus ? 480 : 340)
                if preset != .focus {
                    WorkspaceWatchlist(selection: $selectedSymbol, onInspect: inspect)
                        .frame(height: 300)
                }
                switch preset {
                case .trade:
                    OrderTicketView(symbol: selectedSymbol, side: .buy, style: .inline)
                        .id(selectedSymbol)
                        .frame(height: 640)
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
            if !MarketClock.isOpen(.usEquity) {
                MarketClosedChip()
            }
            WorkspaceModeStamp(text: store.mode.badgeText)
            if preset != .trade {
                Button {
                    Haptics.tap()
                    showingTicket = true
                } label: {
                    Label("New Order", systemImage: "plus")
                        .font(TarsTheme.Text.caption)
                        .lineLimit(1)
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

    // MARK: - Hero chart

    /// The chart is the protagonist: it sits directly on bg0 with no card
    /// chrome, its header row floating above the plot, so the panels around
    /// it (which keep `.tarsPanel()`) visually defer to it.
    private func chartHero(showsStamp: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            heroHeader(showsStamp: showsStamp)
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.m)
                .animation(Motion.snappy, value: selectedSymbol)

            GeometryReader { geo in
                ChartView(symbol: selectedSymbol,
                          height: max(280, geo.size.height - 64))
                    .id(selectedSymbol)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, TarsTheme.Space.s)
        }
    }

    private func heroHeader(showsStamp: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text("CHART")
                    .font(TarsTheme.Text.micro)
                    .tracking(1.2)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Text(selectedSymbol)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .contentTransition(.opacity)
            }
            if showsStamp {
                WorkspaceModeStamp(text: store.mode.badgeText)
            }
            Spacer()
            if let quote = store.quote(for: selectedSymbol) {
                VStack(alignment: .trailing, spacing: 2) {
                    TickerText(value: quote.price,
                               format: .currency(code: "USD").precision(.fractionLength(2)),
                               font: TarsTheme.Text.price)
                    PercentText(value: quote.changePercent)
                    // The flagship price owes the same honesty as everywhere
                    // else: say so when the quote has gone stale.
                    if quote.age > 300 {
                        Label {
                            Text("as of \(quote.asOf.formatted(.relative(presentation: .named)))")
                        } icon: {
                            Image(systemName: "clock")
                        }
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(
                    "\(selectedSymbol) \(quote.price.formatted(.currency(code: "USD").precision(.fractionLength(2)))), \(quote.changePercent.formatted(.percent.precision(.fractionLength(2)))) today"
                )
            } else if store.isBootstrapping {
                SkeletonBlock(width: 90, height: 18)
            }
        }
    }

    // MARK: - Symbol hero overlay (gap 10)

    // A matched-geometry pair across a sheet/fullScreenCover boundary isn't
    // reliable on iOS 17 (separate hosting hierarchies), so the detail page
    // lives in-hierarchy as a full-area cover with a deliberate scale+opacity
    // expansion — never the default slide.
    @ViewBuilder
    private var symbolHeroOverlay: some View {
        if let symbol = inspectedSymbol {
            WorkspaceSymbolCover(symbol: symbol, onClose: closeInspector)
                .transition(reduceMotion
                    ? .opacity
                    : .scale(scale: 0.94).combined(with: .opacity))
                .zIndex(10)
        }
    }

    private func inspect(_ symbol: String) {
        Haptics.tap()
        withAnimation(reduceMotion ? nil : Motion.spatial) { inspectedSymbol = symbol }
    }

    private func closeInspector() {
        withAnimation(reduceMotion ? nil : Motion.spatial) { inspectedSymbol = nil }
    }

    // MARK: - Keyboard layer (gap 16)

    /// Hidden buttons carry the shortcuts so they work anywhere in the
    /// workspace without stealing focus: ⌘1/⌘2/⌘3 presets, ⌘T ticket,
    /// ⌘F focus, ↑/↓ watchlist selection.
    private var keyboardLayer: some View {
        Group {
            Button("Trade layout") { switchPreset(.trade) }
                .keyboardShortcut("1", modifiers: .command)
            Button("Monitor layout") { switchPreset(.monitor) }
                .keyboardShortcut("2", modifiers: .command)
            Button("Focus layout") { switchPreset(.focus) }
                .keyboardShortcut("3", modifiers: .command)
            Button("New order") { showingTicket = true }
                .keyboardShortcut("t", modifiers: .command)
            Button("Focus chart") { switchPreset(.focus) }
                .keyboardShortcut("f", modifiers: .command)
            Button("Previous symbol") { moveWatchlistSelection(-1) }
                .keyboardShortcut(.upArrow, modifiers: [])
            Button("Next symbol") { moveWatchlistSelection(1) }
                .keyboardShortcut(.downArrow, modifiers: [])
        }
        .buttonStyle(.plain)
        .labelsHidden()
        .opacity(0)
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }

    private func switchPreset(_ newPreset: WorkspacePreset) {
        guard preset != newPreset else { return }
        Haptics.tick()
        withAnimation(reduceMotion ? nil : Motion.spatial) { preset = newPreset }
    }

    private func moveWatchlistSelection(_ delta: Int) {
        let list = store.watchlist
        guard !list.isEmpty else { return }
        let current = list.firstIndex(of: selectedSymbol) ?? 0
        let next = min(max(current + delta, 0), list.count - 1)
        guard list[next] != selectedSymbol else { return }
        Haptics.tick()
        withAnimation(reduceMotion ? nil : Motion.snappy) { selectedSymbol = list[next] }
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

// MARK: - Portrait deck

fileprivate enum WorkspaceDeck: String, CaseIterable, Identifiable {
    case watchlist, positions, orders, ticket
    var id: String { rawValue }
    var label: String {
        switch self {
        case .watchlist: "Watchlist"
        case .positions: "Positions"
        case .orders: "Orders"
        case .ticket: "Ticket"
        }
    }
    var icon: String {
        switch self {
        case .watchlist: "list.bullet"
        case .positions: "briefcase"
        case .orders: "clock"
        case .ticket: "bolt"
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
            withAnimation(reduceMotion ? nil : Motion.spatial) {
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

// MARK: - Deck picker (portrait one-panel switcher)

fileprivate struct WorkspaceDeckPicker: View {
    @Binding var selection: WorkspaceDeck
    var reduceMotion: Bool
    @Namespace private var thumbNamespace

    var body: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            ForEach(WorkspaceDeck.allCases) { deck in
                segment(deck)
            }
        }
        .padding(TarsTheme.Space.xs)
        .background(
            Capsule().fill(TarsTheme.bg1)
                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Workspace panel")
    }

    private func segment(_ deck: WorkspaceDeck) -> some View {
        let isSelected = deck == selection
        return Button {
            guard !isSelected else { return }
            Haptics.tick()
            withAnimation(reduceMotion ? nil : Motion.snappy) {
                selection = deck
            }
        } label: {
            HStack(spacing: TarsTheme.Space.xs) {
                Image(systemName: deck.icon)
                    .font(TarsTheme.Text.micro)
                Text(deck.label)
                    .font(TarsTheme.Text.caption)
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, TarsTheme.Space.s)
            .background {
                if isSelected {
                    Capsule()
                        .fill(TarsTheme.bg3)
                        .matchedGeometryEffect(id: "workspace.deck.thumb", in: thumbNamespace)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Show \(deck.label.lowercased()) panel")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
    }
}

// MARK: - Mode stamp (paper-trading honesty)

fileprivate struct WorkspaceModeStamp: View {
    let text: String
    var body: some View { PaperBadge(text: text) }
}

// MARK: - Symbol cover (in-hierarchy hero presentation)

fileprivate struct WorkspaceSymbolCover: View {
    let symbol: String
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            SymbolDetailView(symbol: symbol)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Haptics.tap()
                            onClose()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(TarsTheme.Text.heading)
                                .foregroundStyle(TarsTheme.inkSecondary)
                        }
                        .buttonStyle(PressableStyle())
                        .keyboardShortcut(.cancelAction)
                        .accessibilityLabel("Close \(symbol) details")
                    }
                }
        }
        .background(TarsTheme.bg0)
    }
}

// MARK: - Compact workspace watchlist (selection drives the chart)

/// A tight, selection-aware watchlist owned by the workspace. Deliberately
/// separate from `WatchlistPanel` (which has no selection concept) so that
/// tapping a row retargets the chart without touching the Terminal module.
fileprivate struct WorkspaceWatchlist: View {
    @Environment(TradingStore.self) private var store
    @Binding var selection: String
    var onInspect: (String) -> Void

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
                .accessibilityElement(children: .combine)
            } else {
                ScrollView {
                    LazyVStack(spacing: TarsTheme.Space.xs) {
                        ForEach(store.watchlist, id: \.self) { symbol in
                            WorkspaceWatchlistRow(
                                symbol: symbol,
                                isSelected: symbol == selection,
                                onSelect: {
                                    guard selection != symbol else { return }
                                    Haptics.tick()
                                    withAnimation(Motion.snappy) { selection = symbol }
                                },
                                onInspect: { onInspect(symbol) })
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
    let onInspect: () -> Void

    // Tabular columns: price and percent live in fixed trailing frames with
    // one uniform font so every row lines up; autoshrink happens only inside
    // the fixed frame as a last resort (TickerText's built-in floor).
    fileprivate static let priceColumnWidth: CGFloat = 96
    fileprivate static let percentColumnWidth: CGFloat = 64

    var body: some View {
        let quote = store.quote(for: symbol)
        HStack(spacing: 0) {
            Button(action: onSelect) {
                HStack(spacing: TarsTheme.Space.s) {
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.capsule, style: .continuous)
                        .fill(isSelected ? TarsTheme.accent : Color.clear)
                        .frame(width: 3, height: 24)
                    Text(symbol)
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(isSelected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let quote {
                        TickerText(value: quote.price,
                                   format: .currency(code: "USD").precision(.fractionLength(2)),
                                   font: TarsTheme.Text.priceSmall)
                            .frame(width: Self.priceColumnWidth, alignment: .trailing)
                        PercentText(value: quote.changePercent, font: TarsTheme.Text.priceSmall)
                            .frame(width: Self.percentColumnWidth, alignment: .trailing)
                    } else {
                        SkeletonBlock(width: 70, height: 12)
                            .frame(width: Self.priceColumnWidth + TarsTheme.Space.s + Self.percentColumnWidth,
                                   alignment: .trailing)
                    }
                }
                .padding(.leading, TarsTheme.Space.s)
                .frame(minHeight: TarsTheme.Metrics.row)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .hoverEffect(.highlight)
            .accessibilityLabel("Show \(symbol) chart")
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])

            Button(action: onInspect) {
                Image(systemName: "chevron.forward.circle")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(width: TarsTheme.Metrics.minTarget, height: TarsTheme.Metrics.minTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .hoverEffect(.highlight)
            .accessibilityLabel("\(symbol) details")
            .accessibilityHint("Opens the full symbol page.")
        }
        .padding(.trailing, TarsTheme.Space.xs)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(isSelected ? TarsTheme.bg3 : Color.clear)
        )
        .animation(Motion.snappy, value: isSelected)
        .contextMenu {
            Button(action: onSelect) {
                Label("Show chart", systemImage: "chart.xyaxis.line")
            }
            Button(action: onInspect) {
                Label("Open \(symbol)", systemImage: "arrow.up.forward.square")
            }
        }
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
