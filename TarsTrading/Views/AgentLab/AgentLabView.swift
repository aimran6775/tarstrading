import SwiftUI

/// Agent Lab home. Placeholder shell — replaced by the full lab in the
/// Act VII build wave (strategy builder, backtest playback, fund mode).
struct AgentLabView: View {
    @Environment(AgentLab.self) private var lab

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 40))
                .foregroundStyle(TarsTheme.agentPurple)
            Text("Agent Lab").font(TarsTheme.Text.title).foregroundStyle(TarsTheme.inkPrimary)
            Text("\(lab.agents.count) agents · lab UI wave landing shortly")
                .font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
