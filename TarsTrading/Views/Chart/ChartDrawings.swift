import SwiftUI

// MARK: - Chart drawings — user-placed levels and trendlines
//
// Value types, persistence, and hit-test math for ChartView's pencil tools.
// These are internal (not fileprivate) only because ChartView lives in a
// sibling file; nothing outside Views/Chart should reach for them.

/// What the pencil places.
enum ChartDrawingKind: String, Codable, CaseIterable, Identifiable {
    case level      // horizontal price line
    case trendline  // A → B segment

    var id: String { rawValue }

    var title: String {
        switch self {
        case .level: "Horizontal level"
        case .trendline: "Trendline"
        }
    }

    var symbolName: String {
        switch self {
        case .level: "minus"
        case .trendline: "line.diagonal"
        }
    }
}

/// A single drawing, stored per symbol. Levels only use the A anchor;
/// trendlines use both.
struct ChartDrawing: Codable, Identifiable, Equatable {
    var id = UUID()
    var kind: ChartDrawingKind
    var timeA: Date
    var priceA: Double
    var timeB: Date
    var priceB: Double
}

/// UserDefaults persistence, keyed "drawings-SYMBOL".
enum ChartDrawingStore {
    static func load(symbol: String) -> [ChartDrawing] {
        guard let data = UserDefaults.standard.data(forKey: key(symbol)) else { return [] }
        return (try? JSONDecoder().decode([ChartDrawing].self, from: data)) ?? []
    }

    static func save(_ drawings: [ChartDrawing], symbol: String) {
        guard !drawings.isEmpty else {
            UserDefaults.standard.removeObject(forKey: key(symbol))
            return
        }
        guard let data = try? JSONEncoder().encode(drawings) else { return }
        UserDefaults.standard.set(data, forKey: key(symbol))
    }

    private static func key(_ symbol: String) -> String { "drawings-\(symbol)" }
}

/// Screen-space math for hit-testing drawings.
enum ChartDrawingGeometry {
    /// Distance from `p` to the segment `a`–`b`.
    static func distance(from p: CGPoint, toSegment a: CGPoint, _ b: CGPoint) -> CGFloat {
        let ab = CGVector(dx: b.x - a.x, dy: b.y - a.y)
        let ap = CGVector(dx: p.x - a.x, dy: p.y - a.y)
        let lengthSquared = ab.dx * ab.dx + ab.dy * ab.dy
        guard lengthSquared > 0 else { return hypot(ap.dx, ap.dy) }
        let t = max(0, min(1, (ap.dx * ab.dx + ap.dy * ab.dy) / lengthSquared))
        let closest = CGPoint(x: a.x + ab.dx * t, y: a.y + ab.dy * t)
        return hypot(p.x - closest.x, p.y - closest.y)
    }
}
