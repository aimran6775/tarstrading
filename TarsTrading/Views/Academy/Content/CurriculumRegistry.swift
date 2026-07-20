import Foundation

/// Deliberate track order: foundations first, risk before funds, always.
enum CurriculumRegistry {
    static func install() {
        Curriculum.registeredTracks = [
            Curriculum.trackFoundations,
            Curriculum.trackEquities,
            Curriculum.trackOptions,
            Curriculum.trackMacro,
            Curriculum.trackRisk,
            Curriculum.trackFunds,
        ]
    }
}
