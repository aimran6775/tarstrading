import SwiftUI
import Foundation

// MARK: - Core market-mechanics teaching widgets
// Four playable sandboxes: the order book, candle anatomy, order types, and
// the dividend calendar. Learning by poking, not by reading. Everything except
// the four deliverable widgets is fileprivate and prefixed CW to stay out of
// sibling files' way.

// MARK: Shared chrome

fileprivate struct CWWidgetCard<Content: View>: View {
    let icon: String
    let title: String
    let subtitle: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(TarsTheme.accent)
                    .frame(width: 32, height: 32)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .fill(TarsTheme.bg3)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(subtitle)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
            }
            content()
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }
}

/// One-line narrator. The widget teaches by doing; this line says what just happened.
fileprivate struct CWCaption: View {
    let text: String
    var tone: Color = TarsTheme.accent

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(tone.opacity(0.8))
                .frame(width: 2)
                .frame(maxHeight: .infinity)
            Text(text)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(Motion.spatial, value: text)
    }
}

fileprivate struct CWChip: View {
    let title: String
    var active: Bool = false
    var tint: Color = TarsTheme.accent
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(TarsTheme.Text.caption)
                .monospacedDigit()
                .foregroundStyle(active ? TarsTheme.bg0 : TarsTheme.inkPrimary)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(Capsule(style: .continuous).fill(active ? tint : TarsTheme.bg3))
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: active ? 0 : 1)
                )
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }
}

fileprivate struct CWStat: View {
    let label: String
    let value: String
    var color: Color = TarsTheme.inkPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .textCase(.uppercase)
            Text(value)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(color)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

fileprivate func cwUSD(_ v: Double, decimals: Int = 2) -> String {
    String(format: "$%.\(decimals)f", v)
}

// MARK: - 1. Order Book Simulator

fileprivate struct CWBookLevel: Identifiable, Equatable {
    let id: Int
    let price: Double
    let size: Double        // original resting size
    var remaining: Double   // shrinks as fills walk the book
}

fileprivate enum CWBookSide { case bid, ask }

fileprivate enum CWOrderKind: String, CaseIterable { case market = "Market", limit = "Limit" }

fileprivate struct CWLadderRow: View {
    let price: Double
    let size: Double
    let remaining: Double
    let maxSize: Double
    let side: CWBookSide
    var flashing: Bool = false
    var isYours: Bool = false

    private var tint: Color { side == .ask ? TarsTheme.loss : TarsTheme.gain }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: side == .ask ? .trailing : .leading) {
                // Depth bar — original size ghosted, remaining solid.
                Capsule(style: .continuous)
                    .fill(tint.opacity(0.10))
                    .frame(width: geo.size.width * size / maxSize)
                Capsule(style: .continuous)
                    .fill(tint.opacity(flashing ? 0.55 : 0.26))
                    .frame(width: max(0, geo.size.width * remaining / maxSize))
                HStack {
                    if isYours {
                        Text("YOU")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.bg0)
                            .padding(.horizontal, TarsTheme.Space.xs)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(TarsTheme.accent))
                    }
                    Text(cwUSD(price))
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(flashing ? TarsTheme.inkPrimary : tint)
                    Spacer()
                    Text(remaining > 0 ? String(format: "%.0f", remaining) : "—")
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(remaining > 0 ? TarsTheme.inkSecondary : TarsTheme.inkTertiary)
                        .contentTransition(.numericText())
                }
            }
        }
        .frame(height: 19)
        .overlay(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .strokeBorder(isYours ? TarsTheme.accent.opacity(0.7) : Color.clear, lineWidth: 1)
        )
        .animation(Motion.snappy, value: remaining)
        .animation(Motion.snappy, value: flashing)
    }
}

/// A playable limit order book. Place a market or limit buy against synthetic
/// resting asks and watch the fill walk the ladder — then read the bill.
struct OrderBookSimWidget: View {
    @State private var asks: [CWBookLevel] = Self.freshAsks
    @State private var bids: [CWBookLevel] = Self.freshBids
    @State private var kind: CWOrderKind = .market
    @State private var qty: Double = 300
    @State private var limitPrice: Double = 99.98
    @State private var resting: (price: Double, qty: Double)? = nil
    @State private var flashID: Int? = nil
    @State private var avgFill: Double? = nil
    @State private var slippage: Double? = nil
    @State private var filledQty: Double = 0
    @State private var busy = false
    @State private var caption = "Pick Market or Limit, then Buy. The ladder shows who's already waiting — asks above, bids below."

    private static let freshAsks: [CWBookLevel] = [
        .init(id: 4, price: 100.14, size: 420, remaining: 420),
        .init(id: 3, price: 100.09, size: 300, remaining: 300),
        .init(id: 2, price: 100.05, size: 240, remaining: 240),
        .init(id: 1, price: 100.02, size: 180, remaining: 180),
    ]
    private static let freshBids: [CWBookLevel] = [
        .init(id: 11, price: 99.98, size: 210, remaining: 210),
        .init(id: 12, price: 99.95, size: 260, remaining: 260),
        .init(id: 13, price: 99.91, size: 330, remaining: 330),
        .init(id: 14, price: 99.86, size: 400, remaining: 400),
    ]
    private var maxSize: Double { 420 }

    var body: some View {
        CWWidgetCard(
            icon: "list.number",
            title: "Order Book",
            subtitle: "Every trade has a counterparty. Meet them."
        ) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                ladder
                controls
                if let avgFill, let slippage {
                    HStack(spacing: TarsTheme.Space.m) {
                        CWStat(label: "Filled", value: String(format: "%.0f sh", filledQty))
                        CWStat(label: "Avg fill", value: cwUSD(avgFill))
                        CWStat(label: "Slippage", value: String(format: "%.1f¢/sh", slippage * 100),
                               color: slippage > 0.001 ? TarsTheme.warning : TarsTheme.inkPrimary)
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
                CWCaption(text: caption)
            }
            .animation(Motion.spatial, value: avgFill != nil)
        }
    }

    private var ladder: some View {
        VStack(spacing: 3) {
            ForEach(asks) { lvl in
                CWLadderRow(price: lvl.price, size: lvl.size, remaining: lvl.remaining,
                            maxSize: maxSize, side: .ask, flashing: flashID == lvl.id)
            }
            HStack {
                Text("SPREAD")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Rectangle().fill(TarsTheme.hairline).frame(height: 1)
                Text(String(format: "%.0f¢", spread * 100))
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .padding(.vertical, 1)
            ForEach(displayBids, id: \.key) { row in
                CWLadderRow(price: row.level.price, size: row.level.size,
                            remaining: row.level.remaining, maxSize: maxSize,
                            side: .bid, isYours: row.yours)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Order book ladder, asks above the spread, bids below")
    }

    private var spread: Double {
        let bestAsk = asks.last(where: { $0.remaining > 0 })?.price ?? 100.14
        let bestBid = max(bids.first?.price ?? 99.98, resting?.price ?? 0)
        return max(0, bestAsk - bestBid)
    }

    private var displayBids: [(key: String, level: CWBookLevel, yours: Bool)] {
        var rows = bids.map { (key: "b\($0.id)", level: $0, yours: false) }
        if let resting {
            let mine = CWBookLevel(id: 99, price: resting.price, size: resting.qty, remaining: resting.qty)
            let idx = rows.firstIndex(where: { $0.level.price <= resting.price }) ?? rows.count
            rows.insert((key: "you", level: mine, yours: true), at: idx)
        }
        return rows
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(CWOrderKind.allCases, id: \.self) { k in
                    CWChip(title: k.rawValue, active: kind == k) {
                        withAnimation(Motion.snappy) { kind = k }
                    }
                }
                Spacer()
                Button {
                    Haptics.confirm()
                    placeOrder()
                } label: {
                    Text("Buy \(Int(qty))")
                        .font(TarsTheme.Text.caption)
                        .monospacedDigit()
                        .foregroundStyle(TarsTheme.bg0)
                        .padding(.horizontal, TarsTheme.Space.l)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(Capsule(style: .continuous).fill(TarsTheme.gain))
                }
                .buttonStyle(PressableStyle())
                .disabled(busy)
                .opacity(busy ? 0.5 : 1)
                .accessibilityLabel("Buy \(Int(qty)) shares")
                .accessibilityHint("Sends a simulated \(kind.rawValue.lowercased()) order into the book")
                Button {
                    Haptics.tap()
                    reset()
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(TarsTheme.bg3))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Reset the book")
            }
            HStack(spacing: TarsTheme.Space.l) {
                Stepper(value: $qty, in: 100...600, step: 100) {
                    Text("Qty \(Int(qty))")
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .fixedSize()
                if kind == .limit {
                    Stepper(value: $limitPrice, in: 99.86...100.14, step: 0.01) {
                        Text("Limit \(cwUSD(limitPrice))")
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.accent)
                    }
                    .fixedSize()
                    .transition(.opacity)
                }
                Spacer(minLength: 0)
            }
            .animation(Motion.snappy, value: kind)
        }
    }

    private func reset() {
        withAnimation(Motion.spatial) {
            asks = Self.freshAsks
            bids = Self.freshBids
            resting = nil
            avgFill = nil
            slippage = nil
            filledQty = 0
            flashID = nil
            caption = "Fresh book. Same game: market orders pay for speed, limit orders wait for price."
        }
    }

    private func placeOrder() {
        guard !busy else { return }
        busy = true
        Task { @MainActor in
            defer { busy = false }
            let bestAsk = asks.last(where: { $0.remaining > 0 })?.price
            var qtyLeft = qty
            var cost = 0.0
            var filled = 0.0
            var levelsEaten = 0

            // Walk the asks from cheapest upward. Market eats everything in its
            // path; a limit only eats levels at or below its cap.
            for i in asks.indices.reversed() {
                guard qtyLeft > 0, asks[i].remaining > 0 else { continue }
                if kind == .limit && asks[i].price > limitPrice + 1e-9 { break }
                let take = min(asks[i].remaining, qtyLeft)
                withAnimation(Motion.snappy) {
                    asks[i].remaining -= take
                    flashID = asks[i].id
                }
                Haptics.tick()
                cost += take * asks[i].price
                filled += take
                qtyLeft -= take
                levelsEaten += 1
                try? await Task.sleep(for: .milliseconds(280))
            }
            withAnimation(Motion.snappy) { flashID = nil }

            if filled > 0 {
                let avg = cost / filled
                withAnimation(Motion.spatial) {
                    avgFill = avg
                    slippage = avg - (bestAsk ?? avg)
                    filledQty = filled
                }
                Haptics.fill()
            }

            withAnimation(Motion.spatial) {
                switch (kind, filled > 0, qtyLeft > 0) {
                case (.market, true, false):
                    caption = "Your market buy ate \(levelsEaten) ask level\(levelsEaten == 1 ? "" : "s"). Each level up cost a bit more — that gap between best ask and your average is slippage. Speed has a price tag."
                case (.market, true, true):
                    caption = "You cleared every ask on screen and still wanted more. In a thin book, size is its own worst enemy."
                case (.limit, true, false):
                    caption = "Your limit at \(cwUSD(limitPrice)) crossed the spread, so it filled immediately — but never above your cap. A limit is a price promise, not a patience requirement."
                case (.limit, true, true):
                    resting = (limitPrice, qtyLeft)
                    caption = "Partially filled: \(Int(filled)) shares at or under your cap. The remaining \(Int(qtyLeft)) now rest in the book, waiting for a seller to come down to you."
                case (.limit, false, _):
                    resting = (limitPrice, qty)
                    caption = "Nothing to match at \(cwUSD(limitPrice)) — your order joined the bid queue. You'll fill only if a seller meets your price. Could be seconds. Could be never."
                default:
                    caption = "Nothing happened. Even simulated markets can be anticlimactic."
                }
            }
        }
    }
}

// MARK: - 2. Candle Anatomy

fileprivate enum CWCandlePart { case open, high, low, close }

fileprivate struct CWCandleHandle: View {
    let label: String
    let value: Double
    let tint: Color

    var body: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            Circle()
                .fill(TarsTheme.bg3)
                .overlay(Circle().strokeBorder(tint, lineWidth: 1.5))
                .frame(width: 14, height: 14)
            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Text(cwUSD(value))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText())
            }
        }
        .contentShape(Rectangle().inset(by: -12))
    }
}

/// One big candle you can bend. Drag open, high, low, close — the candle
/// redraws and the narrator tells you what traders would read into it.
struct CandleAnatomyWidget: View {
    @State private var open: Double = 97.5
    @State private var high: Double = 106.5
    @State private var low: Double = 95.0
    @State private var close: Double = 103.0
    @State private var dragging: CWCandlePart? = nil

    private let minP = 90.0, maxP = 110.0
    private let chartH: CGFloat = 178

    private var bullish: Bool { close >= open }
    private var bodyColor: Color { bullish ? TarsTheme.gain : TarsTheme.loss }

    var body: some View {
        CWWidgetCard(
            icon: "chart.bar.fill",
            title: "Candle Anatomy",
            subtitle: "Four numbers, one story. Drag the handles."
        ) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                GeometryReader { geo in
                    let w = geo.size.width
                    let candleX = w * 0.40
                    ZStack(alignment: .topLeading) {
                        gridLines(width: w)
                        // Wick
                        Rectangle()
                            .fill(bodyColor.opacity(0.85))
                            .frame(width: 2, height: max(2, y(low) - y(high)))
                            .position(x: candleX, y: (y(low) + y(high)) / 2)
                        // Body
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(bodyColor)
                            .frame(width: 30, height: max(3, abs(y(open) - y(close))))
                            .position(x: candleX, y: (y(open) + y(close)) / 2)
                            .shadow(color: bodyColor.opacity(0.35), radius: 10)
                        // Handles + labels, each rides its own price.
                        handle(.high, label: "High", x: candleX + 68, y: y(high))
                        handle(.low, label: "Low", x: candleX + 68, y: y(low))
                        handle(.open, label: "Open", x: candleX - 68, y: y(open))
                        handle(.close, label: "Close", x: candleX - 68, y: y(close))
                        // Tether lines from label to candle
                        tether(from: candleX + 34, to: candleX + 2, at: y(high))
                        tether(from: candleX + 34, to: candleX + 2, at: y(low))
                        tether(from: candleX - 34, to: candleX - 16, at: y(open))
                        tether(from: candleX - 34, to: candleX - 16, at: y(close))
                    }
                    .animation(dragging == nil ? Motion.snappy : nil, value: open + high + low + close)
                }
                .frame(height: chartH)
                HStack {
                    Text(bullish ? "BULLISH — closed above the open" : "BEARISH — closed below the open")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(bodyColor)
                        .contentTransition(.opacity)
                        .animation(Motion.snappy, value: bullish)
                    Spacer()
                }
                CWCaption(text: narration, tone: bodyColor)
            }
        }
    }

    private func y(_ price: Double) -> CGFloat {
        chartH * (1 - (price - minP) / (maxP - minP))
    }
    private func price(atY yPos: CGFloat) -> Double {
        minP + (maxP - minP) * Double(1 - yPos / chartH)
    }

    private func gridLines(width: CGFloat) -> some View {
        ForEach([95.0, 100.0, 105.0], id: \.self) { p in
            HStack(spacing: TarsTheme.Space.xs) {
                Rectangle().fill(TarsTheme.hairline).frame(height: 1)
                Text(String(format: "%.0f", p))
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .position(x: width / 2, y: y(p))
        }
    }

    private func tether(from x1: CGFloat, to x2: CGFloat, at yPos: CGFloat) -> some View {
        Path { p in
            p.move(to: CGPoint(x: x1, y: yPos))
            p.addLine(to: CGPoint(x: x2, y: yPos))
        }
        .stroke(TarsTheme.inkTertiary.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
    }

    private func handle(_ part: CWCandlePart, label: String, x: CGFloat, y yPos: CGFloat) -> some View {
        let value: Double = switch part {
        case .open: open
        case .high: high
        case .low: low
        case .close: close
        }
        return CWCandleHandle(label: label, value: value,
                              tint: dragging == part ? TarsTheme.accent : TarsTheme.inkTertiary)
            .position(x: x, y: yPos)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        if dragging != part { dragging = part; Haptics.tick() }
                        let raw = price(atY: g.location.y)
                        set(part, to: raw)
                    }
                    .onEnded { _ in dragging = nil; Haptics.tap() }
            )
            .accessibilityLabel("\(label) price handle")
            .accessibilityValue(cwUSD(value))
            .accessibilityHint("Drag up or down to change the \(label.lowercased()) price")
    }

    private func set(_ part: CWCandlePart, to raw: Double) {
        let v = (raw * 10).rounded() / 10
        switch part {
        case .high: high = min(maxP, max(v, max(open, close)))
        case .low: low = max(minP, min(v, min(open, close)))
        case .open: open = min(high, max(low, v))
        case .close: close = min(high, max(low, v))
        }
    }

    private var narration: String {
        let body = abs(close - open)
        let range = max(high - low, 0.001)
        let upper = high - max(open, close)
        let lower = min(open, close) - low
        if body / range < 0.08 {
            return "A doji: open and close nearly touch. The session went places, but ended in a shrug. Neither side won — indecision, drawn in wax."
        }
        if upper > body * 2 {
            return "Long upper wick: buyers pushed all the way to \(cwUSD(high)), and sellers rejected every bit of it. The candle remembers where the ambition died."
        }
        if lower > body * 2 {
            return "Long lower wick: sellers drove it down to \(cwUSD(low)) and buyers bought the whole dip back. That tail is absorbed panic."
        }
        if body / range > 0.75 {
            return bullish
                ? "Nearly all body, barely any wick: buyers controlled the session from open to close. Conviction — at least for one candle."
                : "A thick red body with tiny wicks: sellers held the wheel the entire session. One candle of conviction, not a forecast."
        }
        return bullish
            ? "Opened \(cwUSD(open)), closed \(cwUSD(close)) — a green candle with wicks on both ends. Some fight in both directions; buyers finished ahead."
            : "Opened \(cwUSD(open)), closed \(cwUSD(close)) — red, with wicks marking failed excursions both ways. Sellers took the session."
    }
}

// MARK: - 3. Order Type Playground

fileprivate enum CWPlayOrder: String, CaseIterable {
    case limitBuy = "Limit buy"
    case stopSell = "Stop sell"

    var tint: Color {
        switch self {
        case .limitBuy: TarsTheme.gain
        case .stopSell: TarsTheme.loss
        }
    }
}

/// Smooth deterministic wander around $100 — lively enough to feel like a
/// market, bounded enough to stay on the chart.
fileprivate func cwWanderPrice(_ t: Double) -> Double {
    100 + 2.6 * Foundation.sin(0.9 * t)
        + 1.4 * Foundation.sin(2.3 * t + 1.3)
        + 0.7 * Foundation.sin(5.1 * t + 2.1)
}

/// A live price line and two kinds of tripwire. Drag your order into its
/// path, then watch why it fires — or doesn't.
struct OrderTypePlaygroundWidget: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var history: [Double] = []
    @State private var phase: Double = .random(in: 0...50)
    @State private var order: CWPlayOrder = .limitBuy
    @State private var armedPrice: Double = 97.4
    @State private var armed = true
    @State private var filled = false
    @State private var fillPrice: Double? = nil
    @State private var pulseID = 0
    @State private var speed: Double = 1.0
    @State private var caption = "Drag the dashed handle into the price's path. A limit buy fills at your price or better; a stop sell fires at your price or worse."

    private let minP = 94.0, maxP = 106.0
    private let capacity = 150
    private let chartH: CGFloat = 132

    var body: some View {
        CWWidgetCard(
            icon: "scope",
            title: "Order Types",
            subtitle: "Set a tripwire. Let the market walk into it."
        ) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                chart
                HStack(spacing: TarsTheme.Space.s) {
                    ForEach(CWPlayOrder.allCases, id: \.self) { o in
                        CWChip(title: o.rawValue, active: order == o, tint: o.tint) {
                            switchOrder(to: o)
                        }
                    }
                    Spacer()
                    if filled {
                        CWChip(title: "Re-arm", tint: TarsTheme.accent) { rearm() }
                            .transition(.opacity.combined(with: .scale(scale: 0.9)))
                    }
                    ForEach([0.5, 1.0, 2.0], id: \.self) { s in
                        CWChip(title: s == 0.5 ? "½×" : "\(Int(s))×", active: speed == s) {
                            speed = s
                        }
                        .accessibilityLabel(s == 0.5 ? "Half speed" : "\(Int(s)) times speed")
                    }
                }
                .animation(Motion.snappy, value: filled)
                CWCaption(text: caption, tone: order.tint)
            }
        }
        .task { await runMarket() }
    }

    private var chart: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(TarsTheme.bg1)
                // Price polyline
                Canvas { ctx, size in
                    guard history.count > 1 else { return }
                    var path = Path()
                    for (i, p) in history.enumerated() {
                        let pt = CGPoint(
                            x: size.width * CGFloat(i) / CGFloat(capacity - 1),
                            y: y(p))
                        i == 0 ? path.move(to: pt) : path.addLine(to: pt)
                    }
                    ctx.stroke(path, with: .color(TarsTheme.accent),
                               style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                }
                // Order line + drag handle
                orderLine(width: w)
                // Fill pulse at the moment of truth
                if let fillPrice, filled {
                    CWFillPulse(reduceMotion: reduceMotion)
                        .id(pulseID)
                        .position(x: currentX(width: w), y: y(fillPrice))
                }
                // Current price dot
                if let last = history.last {
                    Circle()
                        .fill(TarsTheme.accent)
                        .frame(width: 6, height: 6)
                        .position(x: currentX(width: w), y: y(last))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
        }
        .frame(height: chartH)
        .accessibilityLabel("Wandering price chart with your \(order.rawValue) order line at \(cwUSD(armedPrice))")
    }

    private func orderLine(width: CGFloat) -> some View {
        let yPos = y(armedPrice)
        return ZStack(alignment: .topLeading) {
            Path { p in
                p.move(to: CGPoint(x: 0, y: yPos))
                p.addLine(to: CGPoint(x: width, y: yPos))
            }
            .stroke(order.tint.opacity(filled ? 0.35 : 0.9),
                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            HStack(spacing: TarsTheme.Space.xs) {
                Text(filled ? "FILLED \(cwUSD(fillPrice ?? armedPrice))" : cwUSD(armedPrice))
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.xs)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(order.tint.opacity(filled ? 0.6 : 1)))
                Circle()
                    .fill(TarsTheme.bg3)
                    .overlay(Circle().strokeBorder(order.tint, lineWidth: 1.5))
                    .frame(width: 16, height: 16)
            }
            .contentTransition(.numericText())
            .position(x: width - 52, y: yPos)
            .contentShape(Rectangle().inset(by: -14))
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        if filled { rearm() }
                        let clamped = min(maxP - 0.5, max(minP + 0.5, price(atY: g.location.y)))
                        if abs(clamped - armedPrice) > 0.04 { Haptics.tick() }
                        armedPrice = clamped
                    }
                    .onEnded { _ in Haptics.tap() }
            )
            .accessibilityLabel("Order price handle")
            .accessibilityValue(cwUSD(armedPrice))
            .accessibilityHint("Drag up or down to move the order price into the market's path")
        }
    }

    private func y(_ p: Double) -> CGFloat { chartH * (1 - (p - minP) / (maxP - minP)) }
    private func price(atY yPos: CGFloat) -> Double { minP + (maxP - minP) * Double(1 - yPos / chartH) }
    private func currentX(width: CGFloat) -> CGFloat {
        width * CGFloat(max(history.count - 1, 0)) / CGFloat(capacity - 1)
    }

    private func switchOrder(to o: CWPlayOrder) {
        order = o
        rearm()
        caption = o == .limitBuy
            ? "Limit buy armed. It fills only when price comes down to \(cwUSD(armedPrice)) or lower — you name the price, the market names the time."
            : "Stop sell armed. If price falls through \(cwUSD(armedPrice)), it becomes a market sell. It caps the damage, not the exact exit price."
    }

    private func rearm() {
        filled = false
        fillPrice = nil
        armed = true
    }

    @MainActor
    private func runMarket() async {
        // Sim loop drives both the wandering line and crossing detection.
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(33))
            if Task.isCancelled { break }
            phase += 0.033 * speed * (reduceMotion ? 0.5 : 1)
            let prev = history.last ?? cwWanderPrice(phase)
            let p = cwWanderPrice(phase)
            if armed && !filled && prev > armedPrice && p <= armedPrice {
                fire(at: p)
            }
            history.append(p)
            if history.count > capacity { history.removeFirst(history.count - capacity) }
        }
    }

    private func fire(at p: Double) {
        filled = true
        armed = false
        pulseID += 1
        Haptics.fill()
        switch order {
        case .limitBuy:
            fillPrice = armedPrice
            caption = "Filled. Price dipped to \(cwUSD(armedPrice)) and your limit bought there — never worse than the price you named. The cost of that guarantee: it only fills if the market comes to you."
        case .stopSell:
            let slipped = p - 0.06
            fillPrice = slipped
            caption = "Tripped. Price fell through \(cwUSD(armedPrice)); your stop became a market sell and got \(cwUSD(slipped)) — a touch worse than the trigger. Stops promise action, not price."
        }
    }
}

/// One-shot expanding ring at the fill point.
fileprivate struct CWFillPulse: View {
    let reduceMotion: Bool
    @State private var expanded = false

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(TarsTheme.paperBadge, lineWidth: 2)
                .frame(width: 10, height: 10)
                .scaleEffect(expanded ? 3.4 : 0.6)
                .opacity(expanded ? 0 : 0.9)
            Circle()
                .fill(TarsTheme.paperBadge)
                .frame(width: 7, height: 7)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 0.7)) { expanded = true }
        }
    }
}

// MARK: - 4. Dividend Timeline

fileprivate struct CWDivEvent: Identifiable {
    let id: Int
    let name: String
    let day: Int
    let fraction: Double
}

/// The four dates that decide who gets paid. Drag your buy marker around the
/// calendar and watch the coin — and the ex-date gap — do the explaining.
struct DividendTimelineWidget: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var buyFraction: Double = 0.25
    @State private var coinDropID = 0

    private let dividend = 0.62
    private let basePrice = 40.00
    private let events: [CWDivEvent] = [
        .init(id: 0, name: "Declared", day: 0, fraction: 0.06),
        .init(id: 1, name: "Ex-date", day: 20, fraction: 0.46),
        .init(id: 2, name: "Record", day: 21, fraction: 0.58),
        .init(id: 3, name: "Payment", day: 42, fraction: 0.94),
    ]
    private var exFraction: Double { events[1].fraction }
    private var eligible: Bool { buyFraction < exFraction }
    private var buyDay: Int { Int((buyFraction * 42).rounded()) }

    var body: some View {
        CWWidgetCard(
            icon: "calendar.badge.clock",
            title: "Dividend Timeline",
            subtitle: "Own it before the ex-date, or don't get paid."
        ) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                pricePath
                timeline
                HStack(spacing: TarsTheme.Space.m) {
                    CWStat(label: "You buy", value: "Day \(buyDay)")
                    CWStat(label: "Dividend", value: cwUSD(dividend),
                           color: eligible ? TarsTheme.gain : TarsTheme.inkTertiary)
                    CWStat(label: "Verdict", value: eligible ? "Paid" : "Not paid",
                           color: eligible ? TarsTheme.gain : TarsTheme.loss)
                }
                CWCaption(text: caption, tone: eligible ? TarsTheme.gain : TarsTheme.loss)
            }
            .animation(Motion.spatial, value: eligible)
        }
    }

    /// Price gapping down by the dividend on the ex-date. Money doesn't
    /// appear from nowhere — it leaves the share price.
    private var pricePath: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let preY = h * 0.32
            let postY = preY + h * 0.34   // gap ≈ the dividend, exaggerated to be visible
            let exX = w * exFraction
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in
                    var pre = Path()
                    pre.move(to: CGPoint(x: 0, y: preY + 3))
                    pre.addCurve(to: CGPoint(x: exX, y: preY),
                                 control1: CGPoint(x: w * 0.15, y: preY - 5),
                                 control2: CGPoint(x: w * 0.32, y: preY + 6))
                    ctx.stroke(pre, with: .color(TarsTheme.inkSecondary), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                    var gap = Path()
                    gap.move(to: CGPoint(x: exX, y: preY))
                    gap.addLine(to: CGPoint(x: exX, y: postY))
                    ctx.stroke(gap, with: .color(TarsTheme.loss.opacity(0.8)), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                    var post = Path()
                    post.move(to: CGPoint(x: exX, y: postY))
                    post.addCurve(to: CGPoint(x: w, y: postY - 4),
                                  control1: CGPoint(x: w * 0.68, y: postY + 5),
                                  control2: CGPoint(x: w * 0.85, y: postY - 7))
                    ctx.stroke(post, with: .color(TarsTheme.inkSecondary), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                }
                Text("−\(cwUSD(dividend)) gap")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.loss)
                    .position(x: min(exX + 44, w - 34), y: (preY + postY) / 2)
                Text(cwUSD(basePrice))
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .position(x: 20, y: preY - 12)
            }
        }
        .frame(height: 74)
        .accessibilityLabel("Price chart showing the share price gapping down by the dividend on the ex-date")
    }

    private var timeline: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let midY: CGFloat = 22
            ZStack(alignment: .topLeading) {
                // Rail, split at the ex-date: paid side vs unpaid side.
                let paidWidth: CGFloat = w * CGFloat(exFraction)
                let unpaidWidth: CGFloat = w - paidWidth
                Capsule().fill(TarsTheme.gain.opacity(0.35))
                    .frame(width: paidWidth, height: 3)
                    .position(x: paidWidth / 2, y: midY)
                Capsule().fill(TarsTheme.bg3)
                    .frame(width: unpaidWidth, height: 3)
                    .position(x: paidWidth + unpaidWidth / 2, y: midY)
                ForEach(events) { e in
                    let x = w * e.fraction
                    VStack(spacing: 3) {
                        ZStack {
                            Circle()
                                .fill(e.id == 1 ? TarsTheme.paperBadge : TarsTheme.bg3)
                                .overlay(Circle().strokeBorder(
                                    e.id == 1 ? TarsTheme.paperBadge : TarsTheme.inkTertiary, lineWidth: 1))
                                .frame(width: e.id == 1 ? 11 : 8, height: e.id == 1 ? 11 : 8)
                            if e.id == 3 {
                                CWCoin(eligible: eligible, reduceMotion: reduceMotion)
                                    .id(coinDropID)
                                    .offset(y: -20)
                            }
                        }
                        Text(e.name)
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(e.id == 1 ? TarsTheme.paperBadge : TarsTheme.inkTertiary)
                        Text("Day \(e.day)")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .position(x: x, y: midY + 14)
                }
                // Your draggable buy marker
                VStack(spacing: 2) {
                    Text("YOU BUY")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.bg0)
                        .padding(.horizontal, TarsTheme.Space.xs)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(TarsTheme.accent))
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(TarsTheme.accent)
                }
                .position(x: w * buyFraction, y: midY - 16)
                .contentShape(Rectangle().inset(by: -14))
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { g in
                            let f = min(1, max(0, g.location.x / w))
                            let wasEligible = eligible
                            buyFraction = f
                            if wasEligible != eligible {
                                Haptics.confirm()
                                coinDropID += 1
                            }
                        }
                        .onEnded { _ in Haptics.tap() }
                )
                .accessibilityLabel("Buy date marker")
                .accessibilityValue("Day \(buyDay), \(eligible ? "eligible" : "not eligible") for the dividend")
                .accessibilityHint("Drag left or right to change the day you buy")
            }
        }
        .frame(height: 64)
    }

    private var caption: String {
        if eligible {
            let lead = events[1].day - buyDay
            return "You bought \(lead) day\(lead == 1 ? "" : "s") before the ex-date, so you're on the books by the record date — \(cwUSD(dividend)) per share arrives on payment day. But notice the price gapped down by about the same amount. Dividends move money; they don't mint it."
        } else {
            return "You bought on or after the ex-date — this dividend belongs to whoever owned the shares the day before. Consolation: you paid the already-gapped-down price, so you didn't miss as much as it feels like."
        }
    }
}

/// The coin over the payment date: solid and settled when you get paid,
/// ghosted when the seller keeps it.
fileprivate struct CWCoin: View {
    let eligible: Bool
    let reduceMotion: Bool
    @State private var landed = false

    var body: some View {
        Image(systemName: eligible ? "dollarsign.circle.fill" : "dollarsign.circle")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(eligible ? TarsTheme.paperBadge : TarsTheme.inkTertiary.opacity(0.6))
            .overlay {
                if !eligible {
                    Rectangle()
                        .fill(TarsTheme.loss.opacity(0.8))
                        .frame(width: 20, height: 1.5)
                        .rotationEffect(.degrees(-40))
                }
            }
            .offset(y: landed || reduceMotion ? 0 : -14)
            .opacity(landed || reduceMotion ? 1 : 0)
            .onAppear {
                guard !reduceMotion else { landed = true; return }
                withAnimation(Motion.snappy) { landed = true }
            }
    }
}
