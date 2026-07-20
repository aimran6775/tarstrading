import SwiftUI

/// Academy home. Placeholder shell — replaced by the full curriculum UI in
/// the Act V build wave (track cards, adaptive path, XP header).
struct AcademyHomeView: View {
    @Environment(AcademyProgress.self) private var progress

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "graduationcap.fill")
                .font(.system(size: 40))
                .foregroundStyle(TarsTheme.accent)
            Text("Academy").font(TarsTheme.Text.title).foregroundStyle(TarsTheme.inkPrimary)
            Text("Curriculum wave landing shortly")
                .font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
