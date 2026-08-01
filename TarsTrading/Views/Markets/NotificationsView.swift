import SwiftUI

/*
  Everything the desk did while you weren't looking.

  Fills at 3am, margin calls, dividends, splits, analyst decisions — all of
  it used to be discoverable only by noticing a number had changed. Opening
  this asks for the "since you left" digest ONCE (it stamps last-seen, so a
  poll would mean nobody is ever away), then marks the rest read.
*/
struct NotificationsView: View {
    @State private var model = NotificationsModel()
    @State private var pushed: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                if let d = model.digest { digestCard(d) }
                listCard
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $pushed) { MarketSymbolView(symbol: $0) }
        .refreshable { await model.load(digest: false) }
        .task { await model.open() }
    }

    private func digestCard(_ d: SinceYouLeft) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SINCE YOU LEFT").font(TarsTheme.Text.micro).kerning(1.4)
                .foregroundStyle(TarsTheme.paperBadge)
            Text(d.fills > 0
                 ? "\(d.fills) order\(d.fills == 1 ? "" : "s") filled while you were away."
                 : "No fills while you were away.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TarsTheme.paperBadge.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .strokeBorder(TarsTheme.paperBadge.opacity(0.3), lineWidth: 1))
    }

    private var listCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if model.items.isEmpty {
                Text(model.loaded
                     ? "Nothing yet. Fills, margin calls and analyst decisions land here."
                     : "Loading…")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(TarsTheme.Space.l)
            } else {
                ForEach(model.items) { n in
                    Button {
                        if let sym = symbolFrom(n.href) { pushed = sym }
                    } label: { row(n) }
                    .buttonStyle(.plain)
                    .disabled(symbolFrom(n.href) == nil)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func row(_ n: APINotification) -> some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            Image(systemName: icon(n.kind))
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(tone(n.kind))
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(n.title)
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                if let b = n.body, !b.isEmpty {
                    Text(b).font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(Date(timeIntervalSince1970: n.createdAt / 1000), style: .relative)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            Spacer()
            if n.readAt == nil {
                Circle().fill(TarsTheme.paperBadge).frame(width: 7, height: 7)
                    .padding(.top, 5)
                    .accessibilityLabel("Unread")
            }
        }
        .padding(TarsTheme.Space.l)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func icon(_ kind: String) -> String {
        switch kind {
        case "fill": "checkmark.seal.fill"
        case "margin": "exclamationmark.triangle.fill"
        case "analyst": "brain.head.profile"
        case "alert": "bell.fill"
        default: "info.circle.fill"
        }
    }
    private func tone(_ kind: String) -> Color {
        switch kind {
        case "fill": TarsTheme.gain
        case "margin": TarsTheme.loss
        case "analyst": TarsTheme.agentPurple
        case "alert": TarsTheme.paperBadge
        default: TarsTheme.inkTertiary
        }
    }

    /// "/app/m/BTC%2FUSD" → "BTC/USD". Anything else isn't a market link.
    private func symbolFrom(_ href: String?) -> String? {
        guard let href, href.hasPrefix("/app/m/") else { return nil }
        return String(href.dropFirst(7)).removingPercentEncoding
    }
}

@Observable @MainActor
final class NotificationsModel {
    private(set) var items: [APINotification] = []
    private(set) var unread = 0
    private(set) var digest: SinceYouLeft?
    private(set) var loaded = false
    private let api = TarsAPIClient.shared

    /// Opening the screen: ask for the digest once, then clear the badge.
    func open() async {
        await load(digest: true)
        if unread > 0 {
            await api.markNotificationsRead()
            unread = 0
        }
    }

    func load(digest wantDigest: Bool) async {
        if let res = try? await api.notifications(digest: wantDigest) {
            items = res.notifications
            unread = res.unread
            if let d = res.digest { digest = d }
        }
        loaded = true
    }
}
