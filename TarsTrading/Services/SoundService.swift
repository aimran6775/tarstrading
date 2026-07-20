import AudioToolbox
import Foundation

/// The sound identity: short system-sound cues mapped to trading moments.
/// Fully silenced by the user preference; haptics carry the feel when muted.
enum Sound {
    case orderStaged, orderFilled, alert, error, achievement

    private var systemSoundID: SystemSoundID {
        switch self {
        case .orderStaged: 1104   // key press tick
        case .orderFilled: 1054   // gentle chime
        case .alert: 1013
        case .error: 1073
        case .achievement: 1025
        }
    }

    static var enabled = true

    func play() {
        guard Sound.enabled else { return }
        AudioServicesPlaySystemSound(systemSoundID)
    }
}
