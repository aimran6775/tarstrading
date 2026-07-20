import SwiftUI

/// ⌘K from anywhere: find a symbol, jump to a section, add to watchlist.
/// The single fastest way around the app.
struct CommandPalette: View {
    enum Destination {
        case section(RootView.Section)
        case symbol(String)
    }

    let onNavigate: (Destination) -> Void

    @Environment(TradingStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var remoteResults: [Asset] = []
    @State private var searchTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Search field
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(TarsTheme.inkTertiary)
                TextField("Symbols, sections, anything…", text: $query)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .focused($focused)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
            }
            .padding(TarsTheme.Space.l)

            Divider().overlay(TarsTheme.hairline)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    if !sectionMatches.isEmpty {
                        paletteHeader("Go to")
                        ForEach(sectionMatches) { s in
                            row(icon: s.icon, title: s.rawValue, subtitle: nil, badge: nil) {
                                onNavigate(.section(s))
                            }
                        }
                    }
                    if !symbolMatches.isEmpty {
                        paletteHeader("Symbols")
                        ForEach(symbolMatches, id: \.symbol) { asset in
                            symbolRow(asset)
                        }
                    }
                    if query.count >= 2 && symbolMatches.isEmpty && sectionMatches.isEmpty {
                        VStack(spacing: TarsTheme.Space.s) {
                            Text("Nothing for \"\(query)\"")
                                .font(TarsTheme.Text.body)
                                .foregroundStyle(TarsTheme.inkSecondary)
                            Text("Try a ticker like NVDA, or a section like Journal.")
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.inkTertiary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, TarsTheme.Space.xxl)
                    }
                    if query.isEmpty {
                        paletteHeader("Watchlist")
                        ForEach(store.watchlist.prefix(8), id: \.self) { symbol in
                            let name = DemoMarket.universe.first { $0.symbol == symbol }?.name
                            row(icon: "star.fill", title: symbol, subtitle: name, badge: nil) {
                                onNavigate(.symbol(symbol))
                            }
                        }
                    }
                }
                .padding(TarsTheme.Space.m)
            }
        }
        .background(TarsTheme.bg1)
        .onAppear { focused = true }
        .onChange(of: query) { _, newValue in
            searchTask?.cancel()
            let trimmed = newValue.trimmingCharacters(in: .whitespaces)
            guard trimmed.count >= 2 else { remoteResults = []; return }
            searchTask = Task {
                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                if let found = try? await store.marketData.search(trimmed), !Task.isCancelled {
                    remoteResults = found
                }
            }
        }
    }

    // MARK: Matching

    private var sectionMatches: [RootView.Section] {
        guard !query.isEmpty else { return [] }
        return RootView.Section.allCases.filter {
            $0.rawValue.localizedCaseInsensitiveContains(query)
        }
    }

    private var symbolMatches: [Asset] {
        guard !query.isEmpty else { return [] }
        let local = DemoMarket.universe
            .filter {
                $0.symbol.localizedCaseInsensitiveContains(query) ||
                $0.name.localizedCaseInsensitiveContains(query)
            }
            .map { Asset(symbol: $0.symbol, name: $0.name, assetClass: $0.assetClass) }
        var seen = Set(local.map(\.symbol))
        var merged = local
        for asset in remoteResults where !seen.contains(asset.symbol) {
            seen.insert(asset.symbol)
            merged.append(asset)
        }
        return Array(merged.prefix(12))
    }

    // MARK: Rows

    private func symbolRow(_ asset: Asset) -> some View {
        let watched = store.watchlist.contains(asset.symbol)
        return row(icon: asset.assetClass == .crypto ? "bitcoinsign.circle" : "chart.line.uptrend.xyaxis",
                   title: asset.symbol,
                   subtitle: asset.name,
                   badge: watched ? nil : "+ Watch",
                   badgeAction: watched ? nil : {
                       store.addToWatchlist(asset.symbol)
                       Haptics.success()
                   }) {
            onNavigate(.symbol(asset.symbol))
            dismiss()
        }
    }

    private func row(icon: String, title: String, subtitle: String?,
                     badge: String?, badgeAction: (() -> Void)? = nil,
                     action: @escaping () -> Void) -> some View {
        HStack(spacing: TarsTheme.Space.m) {
            Button(action: action) {
                HStack(spacing: TarsTheme.Space.m) {
                    Image(systemName: icon)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.accent)
                        .frame(width: 26)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(TarsTheme.Text.price)
                            .foregroundStyle(TarsTheme.inkPrimary)
                        if let subtitle {
                            Text(subtitle)
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.inkTertiary)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel(title)

            if let badge, let badgeAction {
                Button(action: badgeAction) {
                    Text(badge)
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.accent)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(TarsTheme.accent.opacity(0.14)))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Add \(title) to watchlist")
            }
        }
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, 6)
    }

    private func paletteHeader(_ text: String) -> some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(1.5)
            .foregroundStyle(TarsTheme.inkTertiary)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.top, TarsTheme.Space.m)
    }
}
