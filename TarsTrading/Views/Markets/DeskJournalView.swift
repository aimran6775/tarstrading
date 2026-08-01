import SwiftUI

/*
  The journal — every closed trade and every event the desk imposed, each
  with the sentence that explains what it taught. Margin calls, dividends,
  splits, expiries, financing: the platform's most valuable writing, in
  your pocket.
*/
struct DeskJournalView: View {
    @State private var model = DeskJournalModel()
    @State private var filter: Filter = .all
    enum Filter: String, CaseIterable { case all = "All", trades = "Trades", events = "Events" }

    private var shown: [JournalEntryPayload] {
        let isTrade: (JournalEntryPayload) -> Bool = { $0.side == "sell" || $0.side == "cover" }
        return switch filter {
        case .all: model.entries
        case .trades: model.entries.filter(isTrade)
        case .events: model.entries.filter { !isTrade($0) }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                summaryCard
                filterRow
                entriesCard
            }
            .padding(TarsTheme.Space.l)
            // Clear the floating tab bar — the last card must be readable.
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Journal")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { if model.entries.isEmpty { await model.load() } }
    }

    @ViewBuilder private var summaryCard: some View {
        if let s = model.summary {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())],
                      alignment: .leading, spacing: TarsTheme.Space.l) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("REALIZED").font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Text("\(s.realized >= 0 ? "+" : "")\(s.realized, format: .currency(code: "USD"))")
                        .font(TarsTheme.Text.title.monospacedDigit())
                        .foregroundStyle(s.realized > 0 ? TarsTheme.gain : s.realized < 0 ? TarsTheme.loss : TarsTheme.inkPrimary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("WIN RATE").font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Text(s.winRate.map { String(format: "%.0f%%", $0 * 100) } ?? "—")
                        .font(TarsTheme.Text.title.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                labelled("Closed trades", "\(s.trades)")
                labelled("Desk events", "\(s.events)")
            }
            .padding(TarsTheme.Space.l)
            .tarsPanel()
        }
    }

    private func labelled(_ l: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(l.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text(v).font(TarsTheme.Text.heading.monospacedDigit())
                .foregroundStyle(TarsTheme.inkPrimary)
        }
    }

    private var filterRow: some View {
        HStack(spacing: TarsTheme.Space.s) {
            ForEach(Filter.allCases, id: \.self) { f in
                let on = filter == f
                Button {
                    Haptics.tick(); filter = f
                } label: {
                    Text(f.rawValue)
                        .font(TarsTheme.Text.caption.weight(.semibold))
                        .foregroundStyle(on ? TarsTheme.onFill : TarsTheme.inkSecondary)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(on ? TarsTheme.paperBadge : TarsTheme.bg2)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var entriesCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if shown.isEmpty {
                Text(model.loaded
                     ? "Nothing recorded yet. Close a position and the first entry writes itself."
                     : "Loading…")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(TarsTheme.Space.l)
            } else {
                ForEach(shown) { e in
                    entryRow(e)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func entryRow(_ e: JournalEntryPayload) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(SymbolDisplay.pretty(e.symbol))
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(sideLabel(e.side).uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(sideTone(e.side))
                Spacer()
                if let pnl = e.pnl {
                    Text("\(pnl >= 0 ? "+" : "")\(pnl, format: .currency(code: "USD"))")
                        .font(TarsTheme.Text.body.monospacedDigit())
                        .foregroundStyle(pnl > 0 ? TarsTheme.gain : pnl < 0 ? TarsTheme.loss : TarsTheme.inkTertiary)
                }
            }
            Text(Date(timeIntervalSince1970: e.createdAt / 1000),
                 format: .dateTime.month(.abbreviated).day().hour().minute())
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            // The lesson — the reason this record exists at all.
            if let thesis = e.thesis, !thesis.isEmpty {
                Text(thesis)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .accessibilityElement(children: .combine)
    }

    private func sideLabel(_ s: String) -> String {
        switch s {
        case "sell": "Closed"; case "cover": "Covered"; case "dividend": "Dividend"
        case "split": "Split"; case "expired": "Expired"; case "assigned": "Assigned"
        case "financing": "Financing"; case "margin-call": "Margin call"
        default: s
        }
    }
    private func sideTone(_ s: String) -> Color {
        switch s {
        case "dividend", "financing": TarsTheme.gain
        case "margin-call": TarsTheme.loss
        case "assigned", "split": TarsTheme.warning
        default: TarsTheme.inkTertiary
        }
    }
}

@Observable @MainActor
final class DeskJournalModel {
    private(set) var entries: [JournalEntryPayload] = []
    private(set) var summary: JournalSummary?
    private(set) var loaded = false
    private let api = TarsAPIClient.shared

    func load() async {
        if let res = try? await api.journal() {
            entries = res.entries; summary = res.summary
        }
        loaded = true
    }
}
