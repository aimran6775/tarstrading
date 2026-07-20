import SwiftUI

/// User-tunable app behavior: appearance, complexity mode, sound, haptics.
@Observable
final class PreferencesStore {
    enum ComplexityMode: String, CaseIterable, Identifiable {
        case simple = "Simple"
        case pro = "Pro"
        var id: String { rawValue }
    }

    var complexity: ComplexityMode {
        didSet { UserDefaults.standard.set(complexity.rawValue, forKey: "complexity") }
    }
    var soundOn: Bool {
        didSet { UserDefaults.standard.set(soundOn, forKey: "soundOn") }
    }
    var hapticsOn: Bool {
        didSet { UserDefaults.standard.set(hapticsOn, forKey: "hapticsOn") }
    }
    /// Dark-first product; light is supported but opt-in.
    var forceDark: Bool {
        didSet { UserDefaults.standard.set(forceDark, forKey: "forceDark") }
    }

    var colorScheme: ColorScheme? { forceDark ? .dark : nil }

    init() {
        let d = UserDefaults.standard
        complexity = ComplexityMode(rawValue: d.string(forKey: "complexity") ?? "") ?? .pro
        soundOn = d.object(forKey: "soundOn") as? Bool ?? true
        hapticsOn = d.object(forKey: "hapticsOn") as? Bool ?? true
        forceDark = d.object(forKey: "forceDark") as? Bool ?? true
    }
}
