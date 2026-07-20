import SwiftUI

// MARK: - PositionsScreen
// Full-screen composition: account summary strip, then positions and open
// orders stacked. Pull-to-refresh reconciles everything with the broker.

struct PositionsScreen: View {
    @Environment(TradingStore.self) private var store

    var body: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.l) {
                AccountSummaryStrip()
                PositionsPanel()
                OpenOrdersPanel()
            }
            .padding(TarsTheme.Space.l)
        }
        .background(TarsTheme.bg0)
        .refreshable { await store.refreshAll() }
        .navigationTitle("Portfolio")
    }
}

// MARK: - Account summary strip

fileprivate struct AccountSummaryStrip: View {
    @Environment(TradingStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(alignment: .firstTextBaseline) {
                Text("Equity")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text(store.mode.badgeText)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.paperBadge)
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.vertical, TarsTheme.Space.xs)
                    .background(
                        Capsule().strokeBorder(TarsTheme.paperBadge.opacity(0.5), lineWidth: 1)
                    )
                    .accessibilityLabel("\(store.mode.badgeText) trading mode. No real money.")
            }

            TickerText(value: store.account.equity, font: TarsTheme.Text.priceHero)

            HStack(spacing: TarsTheme.Space.l) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("Day P&L")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    HStack(spacing: TarsTheme.Space.s) {
                        Text(store.account.dayPnL,
                             format: .currency(code: store.account.currency)
                                .sign(strategy: .always(showZero: false)))
                            .font(TarsTheme.Text.price)
                            .foregroundStyle(TarsTheme.pnl(store.account.dayPnL))
                            .contentTransition(.numericText(value: store.account.dayPnL))
                            .animation(Motion.ticker, value: store.account.dayPnL)
                        PercentText(value: store.account.dayPnLPercent)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: TarsTheme.Space.xs) {
                    Text("Buying Power")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    TickerText(value: store.account.buyingPower,
                               font: TarsTheme.Text.price,
                               colorsByDirection: false)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Account equity \(store.account.equity.formatted(.currency(code: store.account.currency))), " +
            "day profit and loss \(store.account.dayPnL.formatted(.currency(code: store.account.currency)))"
        )
    }
}

// MARK: - PositionsPanel

struct PositionsPanel: View {
    @Environment(TradingStore.self) private var store
    @State private var positionToClose: Position?

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            PanelHeader(title: "Positions", count: store.positions.count)

            if store.isBootstrapping {
                PositionsSkeleton()
            } else if store.positions.isEmpty {
                NoPositionsCard()
            } else {
                VStack(spacing: TarsTheme.Space.s) {
                    ForEach(store.positions) { position in
                        NavigationLink {
                            SymbolDetailView(symbol: position.symbol)
                        } label: {
                            PositionRow(position: position)
                        }
                        .buttonStyle(PressableStyle())
                        .contextMenu {
                            Button(role: .destructive) {
                                positionToClose = position
                            } label: {
                                Label("Close Position", systemImage: "xmark.circle")
                            }
                        }
                        .accessibilityLabel(positionAccessibilityLabel(position))
                        .accessibilityHint("Opens symbol detail. Long-press to close the position.")
                    }
                }
                .animation(Motion.fluid, value: store.positions)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .confirmationDialog(
            "Close position?",
            isPresented: Binding(
                get: { positionToClose != nil },
                set: { if !$0 { positionToClose = nil } }
            ),
            titleVisibility: .visible,
            presenting: positionToClose
        ) { position in
            Button("Close \(position.symbol) — \(store.mode.badgeText)", role: .destructive) {
                let target = position
                positionToClose = nil
                Task { await store.closePosition(target) }
            }
            Button("Keep Position", role: .cancel) { positionToClose = nil }
        } message: { position in
            Text("Sells your entire \(position.symbol) position at market. \(store.mode.badgeText) trade — no real money moves.")
        }
    }

    private func positionAccessibilityLabel(_ p: Position) -> String {
        let direction = p.unrealizedPnL >= 0 ? "up" : "down"
        return "\(p.symbol), \(p.qty.formatted()) shares, market value \(p.marketValue.formatted(.currency(code: "USD"))), \(direction) \(abs(p.unrealizedPnL).formatted(.currency(code: "USD")))"
    }
}

// MARK: - Position row

fileprivate struct PositionRow: View {
    let position: Position

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: TarsTheme.Radius.capsule, style: .continuous)
                .fill(TarsTheme.pnl(position.unrealizedPnL))
                .frame(width: 3)
                .padding(.vertical, TarsTheme.Space.xs)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(position.symbol)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(position.qty, format: .number.precision(.fractionLength(0...4)))
                        .font(TarsTheme.Text.priceSmall)
                    Text("@")
                        .font(TarsTheme.Text.caption)
                    Text(position.avgEntryPrice, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.priceSmall)
                }
                .foregroundStyle(TarsTheme.inkSecondary)
            }

            Spacer(minLength: TarsTheme.Space.s)

            VStack(alignment: .trailing, spacing: TarsTheme.Space.xs) {
                TickerText(value: position.marketValue)
                HStack(spacing: TarsTheme.Space.s) {
                    Text(position.unrealizedPnL,
                         format: .currency(code: "USD").sign(strategy: .always(showZero: false)))
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.pnl(position.unrealizedPnL))
                        .contentTransition(.numericText(value: position.unrealizedPnL))
                        .animation(Motion.ticker, value: position.unrealizedPnL)
                    PercentText(value: position.unrealizedPnLPercent)
                }
            }
        }
        .padding(.vertical, TarsTheme.Space.m)
        .padding(.horizontal, TarsTheme.Space.m)
        .tarsPanel(elevation: 2)
        .contentShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
    }
}

// MARK: - Positions empty & loading states

fileprivate struct NoPositionsCard: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drift = false

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            ZStack {
                Circle()
                    .fill(TarsTheme.tarsAurora)
                    .frame(width: 96, height: 96)
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(TarsTheme.Text.hero)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Image(systemName: "sparkle")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent.opacity(0.7))
                    .offset(x: 34, y: -30)
                    .offset(y: drift ? -4 : 2)
                Image(systemName: "sparkle")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.agentPurple.opacity(0.6))
                    .offset(x: -36, y: 26)
                    .offset(y: drift ? 3 : -3)
            }
            .accessibilityHidden(true)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                    drift = true
                }
            }

            VStack(spacing: TarsTheme.Space.xs) {
                Text("No positions yet")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("The terminal is yours. Stage your first paper trade from any chart.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xxl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("No positions yet. The terminal is yours.")
    }
}

fileprivate struct PositionsSkeleton: View {
    var body: some View {
        VStack(spacing: TarsTheme.Space.s) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: TarsTheme.Space.m) {
                    VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                        SkeletonBlock(width: 72, height: 18)
                        SkeletonBlock(width: 110, height: 12)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: TarsTheme.Space.s) {
                        SkeletonBlock(width: 90, height: 16)
                        SkeletonBlock(width: 64, height: 12)
                    }
                }
                .padding(TarsTheme.Space.m)
                .tarsPanel(elevation: 2)
            }
        }
        .accessibilityLabel("Loading positions")
    }
}

// MARK: - OpenOrdersPanel

struct OpenOrdersPanel: View {
    @Environment(TradingStore.self) private var store
    @State private var expandedOrderID: String?

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            PanelHeader(title: "Open Orders", count: store.openOrders.count)

            if store.isBootstrapping {
                VStack(spacing: TarsTheme.Space.s) {
                    ForEach(0..<2, id: \.self) { _ in
                        SkeletonBlock(height: 52)
                    }
                }
                .accessibilityLabel("Loading open orders")
            } else if store.openOrders.isEmpty {
                NoOrdersCard()
            } else {
                VStack(spacing: TarsTheme.Space.s) {
                    ForEach(store.openOrders) { order in
                        OrderRow(
                            order: order,
                            isExpanded: expandedOrderID == order.id,
                            onToggle: {
                                withAnimation(Motion.fluid) {
                                    expandedOrderID = expandedOrderID == order.id ? nil : order.id
                                }
                                Haptics.tap()
                            },
                            onCancel: {
                                Task { await store.cancel(order) }
                            }
                        )
                    }
                }
                .animation(Motion.fluid, value: store.openOrders)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }
}

// MARK: - Empty orders state

fileprivate struct NoOrdersCard: View {
    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "tray")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("No working orders")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Orders you stage will wait here until they fill or you pull them.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            Spacer()
        }
        .padding(.vertical, TarsTheme.Space.xl)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Order row

fileprivate struct OrderRow: View {
    let order: Order
    let isExpanded: Bool
    let onToggle: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                HStack(spacing: TarsTheme.Space.m) {
                    VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                        HStack(spacing: TarsTheme.Space.s) {
                            Text(order.symbol)
                                .font(TarsTheme.Text.heading)
                                .foregroundStyle(TarsTheme.inkPrimary)
                            Text(order.side.label.uppercased())
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(order.side == .buy ? TarsTheme.gain : TarsTheme.loss)
                        }
                        Text(orderSummary)
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkSecondary)
                    }
                    Spacer(minLength: TarsTheme.Space.s)
                    OrderStatusPill(status: order.status)
                    Button(action: onCancel) {
                        Image(systemName: "xmark.circle.fill")
                            .font(TarsTheme.Text.heading)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Cancel \(order.side.label) order for \(order.symbol)")
                }
                .padding(TarsTheme.Space.m)
                .contentShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("\(order.side.label) \(order.qty.formatted()) \(order.symbol), \(order.type.label) order, status \(statusLabel)")
            .accessibilityHint(isExpanded ? "Collapses order timeline" : "Expands order timeline")

            if isExpanded {
                OrderLifecycleView(status: order.status)
                    .padding(.horizontal, TarsTheme.Space.m)
                    .padding(.bottom, TarsTheme.Space.m)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .tarsPanel(elevation: 2)
    }

    private var orderSummary: String {
        var parts: [String] = [order.type.label, order.qty.formatted(.number.precision(.fractionLength(0...4)))]
        if let limit = order.limitPrice {
            parts.append("lmt \(limit.formatted(.currency(code: "USD")))")
        }
        if let stop = order.stopPrice {
            parts.append("stp \(stop.formatted(.currency(code: "USD")))")
        }
        if let trail = order.trailPercent {
            parts.append("trail \(trail.formatted(.number.precision(.fractionLength(0...2))))%")
        }
        parts.append(order.timeInForce.label)
        return parts.joined(separator: " · ")
    }

    private var statusLabel: String {
        order.status.rawValue.replacingOccurrences(of: "_", with: " ")
    }
}

// MARK: - Status pill

fileprivate struct OrderStatusPill: View {
    let status: OrderStatus
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    var body: some View {
        Text(label)
            .font(TarsTheme.Text.micro)
            .foregroundStyle(color)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule().fill(color.opacity(pulsing ? 0.24 : 0.12))
            )
            .overlay(Capsule().strokeBorder(color.opacity(0.35), lineWidth: 1))
            .animation(Motion.snappy, value: status)
            .onAppear {
                guard isLive, !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                    pulsing = true
                }
            }
            .accessibilityLabel("Status: \(label)")
    }

    private var isLive: Bool {
        switch status {
        case .pendingNew, .partiallyFilled: true
        default: false
        }
    }

    private var label: String {
        switch status {
        case .staged: "STAGED"
        case .pendingNew: "PENDING"
        case .accepted, .new: "WORKING"
        case .partiallyFilled: "PARTIAL"
        case .filled: "FILLED"
        case .canceled: "CANCELED"
        case .rejected: "REJECTED"
        case .expired: "EXPIRED"
        }
    }

    private var color: Color {
        switch status {
        case .staged, .pendingNew: TarsTheme.inkSecondary
        case .accepted, .new: TarsTheme.accent
        case .partiallyFilled: TarsTheme.warning
        case .filled: TarsTheme.gain
        case .canceled, .expired: TarsTheme.inkTertiary
        case .rejected: TarsTheme.loss
        }
    }
}

// MARK: - Order lifecycle timeline

/// Horizontal 4-step timeline: Placed → Accepted → Partial → Filled.
/// Steps ahead of the current status render dim; the connecting rail fills
/// with the accent color up to the current step.
fileprivate struct OrderLifecycleView: View {
    let status: OrderStatus

    private static let steps = ["Placed", "Accepted", "Partial", "Filled"]

    private var currentStep: Int {
        switch status {
        case .staged, .pendingNew: 0
        case .accepted, .new: 1
        case .partiallyFilled: 2
        case .filled: 3
        case .canceled, .rejected, .expired: -1
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            if currentStep < 0 {
                Text("Order ended: \(status.rawValue.replacingOccurrences(of: "_", with: " "))")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
            } else {
                HStack(spacing: 0) {
                    ForEach(Array(Self.steps.enumerated()), id: \.offset) { index, name in
                        stepNode(index: index, name: name)
                        if index < Self.steps.count - 1 {
                            rail(reached: index < currentStep)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private func stepNode(index: Int, name: String) -> some View {
        let reached = index <= currentStep
        let isCurrent = index == currentStep
        return VStack(spacing: TarsTheme.Space.xs) {
            ZStack {
                Circle()
                    .fill(reached ? TarsTheme.accent : TarsTheme.bg3)
                    .frame(width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10)
                if reached && index < currentStep {
                    Image(systemName: "checkmark")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.bg0)
                        .scaleEffect(0.6)
                }
            }
            .animation(Motion.snappy, value: currentStep)
            Text(name)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(reached ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
        }
        .frame(minWidth: 52)
    }

    private func rail(reached: Bool) -> some View {
        RoundedRectangle(cornerRadius: TarsTheme.Radius.capsule)
            .fill(reached ? TarsTheme.accent : TarsTheme.hairline)
            .frame(height: 2)
            .frame(maxWidth: .infinity)
            .padding(.bottom, TarsTheme.Space.l)
            .animation(Motion.fluid, value: reached)
    }

    private var accessibilitySummary: String {
        if currentStep < 0 {
            return "Order ended, \(status.rawValue.replacingOccurrences(of: "_", with: " "))"
        }
        return "Order progress: step \(currentStep + 1) of 4, \(Self.steps[currentStep])"
    }
}

// MARK: - Shared panel header

fileprivate struct PanelHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Text(title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            if count > 0 {
                Text("\(count)")
                    .font(TarsTheme.Text.micro)
                    .monospacedDigit()
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.vertical, TarsTheme.Space.xs)
                    .background(Capsule().fill(TarsTheme.bg3))
                    .contentTransition(.numericText(value: Double(count)))
                    .animation(Motion.ticker, value: count)
            }
            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(count) items")
    }
}
