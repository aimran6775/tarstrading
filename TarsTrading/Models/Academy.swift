import SwiftUI

// MARK: - Curriculum data model
// Content lives in code (Views/Academy/Content/*.swift) as static Track values
// registered in Curriculum.tracks — no server, fully offline.

struct Track: Identifiable {
    let id: String
    let title: String
    let tagline: String
    let icon: String            // SF Symbol
    let accent: Color
    let audience: Audience
    let lessons: [Lesson]

    enum Audience: String {
        case beginner = "New to markets"
        case trader = "Already trading"
        case quant = "Numbers person"
        case everyone = "Everyone"
    }
}

struct Lesson: Identifiable {
    let id: String
    let title: String
    let minutes: Int
    let blocks: [LessonBlock]
    var mission: Mission?
    var xp: Int { 50 + blocks.reduce(0) { $0 + ($1.isInteractive ? 25 : 0) } }
}

enum LessonBlock: Identifiable {
    case heading(String)
    case paragraph(String)
    case keyIdea(String)                    // highlighted takeaway card
    case tarsAside(String)                  // Tars-voiced margin note
    case widget(WidgetKind)                 // interactive teaching widget
    case quiz(Quiz)

    var id: String {
        switch self {
        case .heading(let s): "h-\(s.hashValue)"
        case .paragraph(let s): "p-\(s.hashValue)"
        case .keyIdea(let s): "k-\(s.hashValue)"
        case .tarsAside(let s): "t-\(s.hashValue)"
        case .widget(let k): "w-\(k.rawValue)"
        case .quiz(let q): "q-\(q.question.hashValue)"
        }
    }

    var isInteractive: Bool {
        switch self {
        case .widget, .quiz: true
        default: false
        }
    }
}

/// Every interactive teaching widget in the Academy. Views live in
/// Views/Academy/Widgets/ and are mapped in LessonView.
enum WidgetKind: String, CaseIterable {
    case orderBookSim        // playable order book vs simulated flow
    case candleAnatomy       // interactive OHLC candle explorer
    case orderTypePlayground // market vs limit fill visualizer
    case dividendTimeline    // ex-date/payout interactive timeline
    case payoffBuilder       // options payoff diagram builder (multi-leg)
    case greeksLab           // animated delta/theta/vega/gamma
    case termStructure       // futures contango/backwardation curve
    case yieldCurveSculptor  // drag the curve, see inversion
    case positionSizer       // Kelly/fixed-fraction risk sandbox
    case leverageSimulator   // blow up a fake account, safely
    case compoundingCurve    // time-in-market visualizer
    case correlationMatrix   // diversification interactive
}

struct Quiz: Equatable {
    let question: String
    let options: [String]
    let correctIndex: Int
    let explanation: String     // shown after answering, right or wrong
}

/// Lessons end in the real (paper) terminal. Verified against actual account
/// activity — the bridge that makes curriculum and terminal one loop.
struct Mission: Identifiable {
    let id: String
    let title: String
    let detail: String
    let verify: MissionVerify

    enum MissionVerify {
        case placeOrder(type: OrderType?)         // any fill (optionally of a type)
        case journalThesis                        // close a trade with a thesis written
        case addWatchlist(count: Int)
        case holdPositions(count: Int)
        case useBracket
        case askTars
    }
}

/// Global registry. Content files extend this via static lets; the list is
/// assembled here so track order is deliberate.
enum Curriculum {
    static var tracks: [Track] { registeredTracks }
    /// Populated in Curriculum+Registry.swift once content files exist.
    nonisolated(unsafe) static var registeredTracks: [Track] = []
}
