import SwiftUI
import Charts

// MARK: - Agent Lab home: the stable of AI trading agents.
//
// Every agent is explainable by design — its thesis reads in plain English on
// the card, every order it places is tagged, and the kill switch is a
// deliberate physical gesture, not a mis-tappable button.

struct AgentLabView: View {
    @Environment(AgentLab.self) private var lab
    @Environment(TradingStore.self) private var trading

    @State private var builderTarget: LabBuilderTarget?
    @State private var backtestingIDs: Set<UUID> = []

    private let columns = [
        GridItem(.adaptive(minimum: 340, maximum: 560),
                 spacing: TarsTheme.Space.l, alignment: .top)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                header

                if lab.agents.isEmpty {
                    LabEmptyState(
                        onMeetStarters: seedStarters,
                        onBuildOwn: { builderTarget = LabBuilderTarget(agent: nil) })
                        .transition(.opacity.combined(with: .scale(scale: 0.98)))
                } else {
                    LazyVGrid(columns: columns, alignment: .leading,
                              spacing: TarsTheme.Space.l) {
                        ForEach(lab.agents) { agent in
                            LabAgentCard(
                                agent: agent,
                                backtest: lab.backtests[agent.id],
                                isBacktesting: backtestingIDs.contains(agent.id),
                                onRun: { run(agent) },
                                onPause: { pause(agent) },
                                onEdit: { builderTarget = LabBuilderTarget(agent: agent) },
                                onBacktest: { await backtest(agent) },
                                onRevive: { revive(agent) },
                                onKill: { await lab.manualKill(agent.id) })
                        }
                    }

                    activitySection
                }
            }
            .padding(TarsTheme.Space.xl)
            .animation(Motion.spatial, value: lab.agents)
        }
        .background(TarsTheme.bg0)
        .sheet(item: $builderTarget) { target in
            AgentBuilderView(agent: target.agent)
                .presentationBackground(TarsTheme.bg1)
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(alignment: .firstTextBaseline) {
                Text("Agent Lab")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)

                if lab.isEvaluating {
                    HStack(spacing: TarsTheme.Space.xs) {
                        ProgressView()
                            .controlSize(.mini)
                            .tint(TarsTheme.agentPurple)
                        Text("Evaluating signals")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .transition(.opacity)
                }

                Spacer()

                NavigationLink {
                    FundModeView()
                } label: {
                    LabChipLabel(title: "Fund Mode", icon: "building.columns",
                                 tint: TarsTheme.accent)
                }
                .buttonStyle(PressableStyle())

                Button {
                    Haptics.tap()
                    builderTarget = LabBuilderTarget(agent: nil)
                } label: {
                    LabChipLabel(title: "New Agent", icon: "plus",
                                 tint: TarsTheme.agentPurple)
                }
                .buttonStyle(PressableStyle())
            }
            .animation(Motion.snappy, value: lab.isEvaluating)

            Text("Agents trade your paper account. Every order is tagged and explained.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
    }

    // MARK: Activity feed

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Activity")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)

            if lab.activity.isEmpty {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("Nothing logged yet.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Text("Agents narrate every decision they make. Run one and this becomes the most honest trading diary you own.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(TarsTheme.Space.l)
                .tarsPanel()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(lab.activity.prefix(30).enumerated()), id: \.element.id) { index, item in
                        LabActivityRow(item: item)
                        if index < min(lab.activity.count, 30) - 1 {
                            Rectangle()
                                .fill(TarsTheme.hairline)
                                .frame(height: 1)
                        }
                    }
                }
                .tarsPanel()
            }
        }
        .animation(Motion.spatial, value: lab.activity)
    }

    // MARK: Actions

    private func seedStarters() {
        Haptics.success()
        withAnimation(Motion.spatial) {
            for agent in AgentLab.starterAgents() {
                lab.upsert(agent)
            }
        }
    }

    private func run(_ agent: TradingAgent) {
        guard lab.backtests[agent.id] != nil else { return }
        Haptics.confirm()
        withAnimation(Motion.snappy) {
            lab.setStatus(agent.id, .running)
        }
        lab.recordActivity(agent: agent, text: "Started. Trading within its risk limits.")
    }

    private func pause(_ agent: TradingAgent) {
        Haptics.tap()
        withAnimation(Motion.snappy) {
            lab.setStatus(agent.id, .paused)
        }
        lab.recordActivity(agent: agent, text: "Paused by you. Open positions stay open.")
    }

    private func revive(_ agent: TradingAgent) {
        Haptics.tap()
        withAnimation(Motion.spatial) {
            lab.setStatus(agent.id, .draft)
        }
        lab.recordActivity(agent: agent, text: "Revived as a draft. Backtest before it trades again.")
    }

    private func backtest(_ agent: TradingAgent) async {
        guard !backtestingIDs.contains(agent.id) else { return }
        backtestingIDs.insert(agent.id)
        defer { backtestingIDs.remove(agent.id) }
        Haptics.tap()
        let result = await lab.backtest(agent, marketData: trading.marketData)
        if result == nil {
            Haptics.failure()
            lab.recordActivity(agent: agent,
                               text: "Backtest failed — not enough history for its universe.")
        } else {
            Haptics.success()
        }
    }
}

// MARK: - Sheet routing

private struct LabBuilderTarget: Identifiable {
    let id: UUID
    let agent: TradingAgent?

    init(agent: TradingAgent?) {
        self.agent = agent
        self.id = agent?.id ?? UUID()
    }
}

// MARK: - Empty state

fileprivate struct LabEmptyState: View {
    var onMeetStarters: () -> Void
    var onBuildOwn: () -> Void

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 52))
                .foregroundStyle(TarsTheme.agentPurple)
                .padding(TarsTheme.Space.l)
                .background(
                    Circle().fill(TarsTheme.agentPurple.opacity(0.10))
                )
                .accessibilityHidden(true)

            Text("Your stable is empty")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)

            Text("Agents are small, readable trading robots. You give them rules, they trade your paper account, and every order arrives tagged with its reasoning. No black boxes — that's the deal.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 440)

            HStack(spacing: TarsTheme.Space.m) {
                Button(action: onMeetStarters) {
                    Text("Meet the starters")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.bg0)
                        .padding(.horizontal, TarsTheme.Space.xl)
                        .padding(.vertical, TarsTheme.Space.m)
                        .background(Capsule().fill(TarsTheme.agentPurple))
                }
                .buttonStyle(PressableStyle())

                Button(action: onBuildOwn) {
                    Text("Build from scratch")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .padding(.horizontal, TarsTheme.Space.xl)
                        .padding(.vertical, TarsTheme.Space.m)
                        .background(
                            Capsule().fill(TarsTheme.bg3)
                                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
                        )
                }
                .buttonStyle(PressableStyle())
            }
            .padding(.top, TarsTheme.Space.s)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xxl)
        .padding(.horizontal, TarsTheme.Space.xl)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                        .fill(TarsTheme.tarsAurora)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                )
        )
    }
}

// MARK: - Agent card

fileprivate struct LabAgentCard: View {
    let agent: TradingAgent
    let backtest: BacktestResult?
    let isBacktesting: Bool
    var onRun: () -> Void
    var onPause: () -> Void
    var onEdit: () -> Void
    var onBacktest: () async -> Void
    var onRevive: () -> Void
    var onKill: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            titleRow
            thesisBlock
            statsRow

            if agent.status == .killed {
                killedBlock
            }

            actionsRow

            if agent.status == .running {
                LabSlideToKill(agentName: agent.name, onKill: onKill)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
        .overlay(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .strokeBorder(borderTint, lineWidth: 1)
        )
        .animation(Motion.snappy, value: agent.status)
    }

    private var borderTint: Color {
        switch agent.status {
        case .running: TarsTheme.gain.opacity(0.35)
        case .killed: TarsTheme.loss.opacity(0.45)
        default: .clear
        }
    }

    private var titleRow: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Text(agent.emoji)
                .font(TarsTheme.Text.title)
                .frame(width: 46, height: 46)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.bg3)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                Text(agent.universe.joined(separator: " · "))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .lineLimit(1)
            }

            Spacer(minLength: TarsTheme.Space.s)

            LabStatusPill(status: agent.status)
        }
    }

    /// The explainability card: what this agent does, in plain English.
    private var thesisBlock: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(TarsTheme.agentPurple.opacity(0.7))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("THESIS")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .kerning(1.2)
                Text(agent.thesisText)
                    .font(TarsTheme.Text.body)
                    .italic()
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg1)
        )
    }

    private var statsRow: some View {
        HStack(alignment: .bottom, spacing: TarsTheme.Space.l) {
            VStack(alignment: .leading, spacing: 2) {
                Text("ALLOCATION")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .kerning(1.2)
                Text(agent.allocation,
                     format: .currency(code: "USD").precision(.fractionLength(0)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            Spacer(minLength: 0)

            if let backtest {
                if backtest.overfitWarning {
                    Text("⚠️ Overfit risk")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.warning)
                        .padding(.horizontal, TarsTheme.Space.s)
                        .padding(.vertical, TarsTheme.Space.xs)
                        .background(
                            Capsule().fill(TarsTheme.warning.opacity(0.14))
                        )
                }

                VStack(alignment: .trailing, spacing: 2) {
                    Text("OUT-OF-SAMPLE")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .kerning(1.2)
                    LabSparkline(equity: backtest.outOfSample.equity)
                }
            }
        }
    }

    private var killedBlock: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.s) {
            Image(systemName: "octagon.fill")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.loss)
            Text(agent.killedReason ?? "Killed.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.loss)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TarsTheme.Space.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.loss.opacity(0.10))
        )
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    @ViewBuilder
    private var actionsRow: some View {
        HStack(spacing: TarsTheme.Space.s) {
            switch agent.status {
            case .draft:
                backtestButton
                editButton

            case .backtested:
                runButton
                backtestButton
                editButton

            case .running:
                Button(action: onPause) {
                    LabChipLabel(title: "Pause", icon: "pause.fill",
                                 tint: TarsTheme.warning)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Pause \(agent.name)")

            case .paused:
                runButton
                backtestButton
                editButton

            case .killed:
                Button(action: onRevive) {
                    LabChipLabel(title: "Revive as draft", icon: "arrow.counterclockwise",
                                 tint: TarsTheme.inkPrimary)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Revive \(agent.name) as draft")
            }

            Spacer(minLength: 0)

            if backtest != nil {
                NavigationLink {
                    BacktestResultView(agent: agent)
                } label: {
                    LabChipLabel(title: "Results", icon: "chart.xyaxis.line",
                                 tint: TarsTheme.accent)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Backtest results for \(agent.name)")
            }
        }
    }

    private var runButton: some View {
        Button(action: onRun) {
            LabChipLabel(title: "Run", icon: "play.fill", tint: TarsTheme.gain)
        }
        .buttonStyle(PressableStyle())
        .disabled(backtest == nil)
        .opacity(backtest == nil ? 0.4 : 1)
        .accessibilityLabel("Run \(agent.name)")
    }

    private var backtestButton: some View {
        Button {
            Task { await onBacktest() }
        } label: {
            LabChipLabel(title: isBacktesting ? "Testing" : "Backtest",
                         icon: "clock.arrow.circlepath",
                         tint: TarsTheme.inkPrimary,
                         isBusy: isBacktesting)
        }
        .buttonStyle(PressableStyle())
        .disabled(isBacktesting)
        .accessibilityLabel(isBacktesting ? "Backtesting \(agent.name)" : "Backtest \(agent.name)")
    }

    private var editButton: some View {
        Button(action: onEdit) {
            LabChipLabel(title: "Edit", icon: "slider.horizontal.3",
                         tint: TarsTheme.inkPrimary)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Edit \(agent.name)")
    }
}

// MARK: - Status pill

fileprivate struct LabStatusPill: View {
    let status: AgentStatus

    private var tint: Color {
        switch status {
        case .draft: TarsTheme.inkTertiary
        case .backtested: TarsTheme.accent
        case .running: TarsTheme.gain
        case .paused: TarsTheme.warning
        case .killed: TarsTheme.loss
        }
    }

    var body: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            if status == .running {
                LabPulsingDot(color: tint)
            }
            Text(status.label)
                .font(TarsTheme.Text.micro)
                .kerning(0.6)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, TarsTheme.Space.xs)
        .background(Capsule().fill(tint.opacity(0.14)))
    }
}

fileprivate struct LabPulsingDot: View {
    let color: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 6, height: 6)
            .overlay(
                Circle()
                    .stroke(color.opacity(0.6), lineWidth: 1)
                    .scaleEffect(pulsing ? 2.4 : 1)
                    .opacity(pulsing ? 0 : 0.8)
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeOut(duration: 1.2).repeatForever(autoreverses: false)) {
                    pulsing = true
                }
            }
            .accessibilityHidden(true)
    }
}

// MARK: - Backtest sparkline (out-of-sample equity)

fileprivate struct LabSparkline: View {
    let equity: [Double]

    private var trendColor: Color {
        guard let first = equity.first, let last = equity.last else {
            return TarsTheme.inkSecondary
        }
        return TarsTheme.pnl(last - first)
    }

    private var summaryLabel: String {
        guard let first = equity.first, let last = equity.last, equity.count > 1 else {
            return "Out-of-sample equity sparkline, no data yet"
        }
        let from = first.formatted(.currency(code: "USD").precision(.fractionLength(0)))
        let to = last.formatted(.currency(code: "USD").precision(.fractionLength(0)))
        return "Out-of-sample equity, from \(from) to \(to)"
    }

    var body: some View {
        Group {
            if equity.count > 1 {
                Chart(Array(equity.enumerated()), id: \.offset) { index, value in
                    LineMark(x: .value("Day", index), y: .value("Equity", value))
                        .lineStyle(StrokeStyle(lineWidth: 1.5, lineCap: .round))
                        .foregroundStyle(trendColor)
                        .interpolationMethod(.monotone)
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .chartYScale(domain: (equity.min() ?? 0)...(equity.max() ?? 1))
            } else {
                SkeletonBlock(width: 84, height: 26)
            }
        }
        .frame(width: 84, height: 26)
        .accessibilityLabel(summaryLabel)
    }
}

// MARK: - Chip label (shared chrome for buttons and links)

fileprivate struct LabChipLabel: View {
    let title: String
    let icon: String
    var tint: Color = TarsTheme.inkPrimary
    var isBusy = false

    var body: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            if isBusy {
                ProgressView()
                    .controlSize(.mini)
                    .tint(tint)
            } else {
                Image(systemName: icon)
                    .font(TarsTheme.Text.micro)
            }
            Text(title)
                .font(TarsTheme.Text.caption)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, TarsTheme.Space.m)
        .padding(.vertical, TarsTheme.Space.s)
        .background(
            Capsule().fill(TarsTheme.bg3)
                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
    }
}

// MARK: - The kill switch: a deliberate drag, never a tap.

fileprivate struct LabSlideToKill: View {
    let agentName: String
    var onKill: () async -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var isKilling = false
    @State private var armedHapticFired = false

    private let knobSize: CGFloat = 38
    private let trackPadding: CGFloat = 4

    var body: some View {
        GeometryReader { geo in
            let travel = max(geo.size.width - knobSize - trackPadding * 2, 1)
            let progress = dragOffset / travel

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(TarsTheme.loss.opacity(0.10 + 0.12 * progress))
                    .overlay(
                        Capsule().strokeBorder(TarsTheme.loss.opacity(0.35), lineWidth: 1)
                    )

                HStack(spacing: TarsTheme.Space.xs) {
                    Text("SLIDE TO KILL")
                        .font(TarsTheme.Text.micro)
                        .kerning(1.4)
                    Image(systemName: "chevron.right.2")
                        .font(TarsTheme.Text.micro)
                }
                .foregroundStyle(TarsTheme.loss)
                .frame(maxWidth: .infinity)
                .opacity(isKilling ? 0 : 1 - Double(progress) * 1.4)

                Circle()
                    .fill(TarsTheme.loss)
                    .frame(width: knobSize, height: knobSize)
                    .overlay {
                        if isKilling {
                            ProgressView()
                                .controlSize(.small)
                                .tint(TarsTheme.inkPrimary)
                        } else {
                            Image(systemName: "power")
                                .font(TarsTheme.Text.caption.weight(.bold))
                                .foregroundStyle(TarsTheme.inkPrimary)
                        }
                    }
                    .offset(x: trackPadding + dragOffset)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                guard !isKilling else { return }
                                dragOffset = min(max(0, value.translation.width), travel)
                                let armed = dragOffset / travel > 0.92
                                if armed, !armedHapticFired {
                                    armedHapticFired = true
                                    Haptics.warning()
                                } else if !armed {
                                    armedHapticFired = false
                                }
                            }
                            .onEnded { _ in
                                guard !isKilling else { return }
                                if dragOffset / travel > 0.92 {
                                    withAnimation(Motion.snappy) { dragOffset = travel }
                                    isKilling = true
                                    Haptics.killSwitch()
                                    Task {
                                        await onKill()
                                        isKilling = false
                                        dragOffset = 0
                                    }
                                } else {
                                    withAnimation(Motion.snappy) { dragOffset = 0 }
                                    armedHapticFired = false
                                }
                            }
                    )
            }
        }
        .frame(height: knobSize + trackPadding * 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Kill switch for \(agentName)")
        .accessibilityHint("Permanently stops this agent and closes its positions.")
        .accessibilityAction(named: "Kill agent") {
            guard !isKilling else { return }
            isKilling = true
            Haptics.killSwitch()
            Task {
                await onKill()
                isKilling = false
                dragOffset = 0
            }
        }
    }
}

// MARK: - Activity feed row

fileprivate struct LabActivityRow: View {
    let item: AgentLab.AgentActivity

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
            Text(item.agentName)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.agentPurple)
                .lineLimit(1)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, TarsTheme.Space.xs)
                .background(Capsule().fill(TarsTheme.agentPurple.opacity(0.14)))
                .frame(width: 128, alignment: .leading)

            Text(item.text)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: TarsTheme.Space.s)

            Text(item.at, format: .relative(presentation: .named))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkTertiary)
                .lineLimit(1)
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.m)
    }
}
