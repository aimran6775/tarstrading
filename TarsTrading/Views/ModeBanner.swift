import SwiftUI

/// Hard safety requirement: trading mode is visually unmistakable, always.
/// Amber capsule, gentle breathing glow, pinned to the top of every screen.
/// `compact` is the iPhone form — smaller, never absent.
struct ModeBanner: View {
    var compact = false

    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false

    var body: some View {
        HStack(spacing: compact ? TarsTheme.Space.xs : TarsTheme.Space.s) {
            Circle()
                .fill(TarsTheme.paperBadge)
                .frame(width: compact ? 6 : 7, height: compact ? 6 : 7)
                .opacity(breathing ? 1 : 0.45)
            Text(store.mode.badgeText)
                .font(TarsTheme.Text.micro)
                .kerning(compact ? 1.4 : 2)
            if !compact {
                Text(store.mode == .demo ? "Simulated market — no real money" : "Paper account — no real money")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            } else {
                Text("No real money")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(TarsTheme.paperBadge)
        .padding(.horizontal, compact ? TarsTheme.Space.m : TarsTheme.Space.l)
        .padding(.vertical, compact ? 4 : 6)
        .background(
            Capsule()
                .fill(TarsTheme.paperBadge.opacity(0.12))
                .overlay(Capsule().strokeBorder(TarsTheme.paperBadge.opacity(0.35), lineWidth: 1))
                .shadow(color: TarsTheme.paperBadge.opacity(breathing ? 0.35 : 0.1), radius: 8)
        )
        .padding(.top, compact ? TarsTheme.Space.xs : TarsTheme.Space.s)
        .onAppear {
            // The breathing glow is decorative; with Reduce Motion on, hold the
            // fully-lit steady state instead of pulsing forever.
            if reduceMotion {
                breathing = true
            } else {
                withAnimation(Motion.breathe(2.2).repeatForever(autoreverses: true)) {
                    breathing = true
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(store.mode.badgeText) mode. No real money.")
    }
}
