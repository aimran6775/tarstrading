import SwiftUI

/*
  The door. First thing anyone sees, so it must already be the award app:
  the void background, the gold identity, the honesty line about simulated
  money — and nothing else. A sign-in screen earns trust by being calm.

  Signing in here joins the SAME account as tarstrading.com — one desk,
  one $100k, every device.
*/
struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    enum Field { case email, password }

    private var canSubmit: Bool {
        email.contains("@") && password.count >= 8 && session.phase != .authenticating
    }

    var body: some View {
        ZStack {
            TarsTheme.bg0.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 40)

                // Identity — the gold mark and the promise.
                VStack(spacing: 14) {
                    Image(systemName: "triangle.fill")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(TarsTheme.paperBadge)
                        .accessibilityHidden(true)
                    Text("TARS TRADING")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .kerning(3)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("A flight simulator for markets.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .padding(.bottom, 44)

                // The form — two fields, one button, no decoration.
                VStack(spacing: 12) {
                    field("Email", text: $email, focused: .email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .onSubmit { focus = .password }

                    secureField("Password", text: $password, focused: .password)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit { if canSubmit { submit() } }

                    if let error = session.signInError {
                        Text(error)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.loss)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .transition(.opacity)
                            .accessibilityAddTraits(.updatesFrequently)
                    }

                    Button(action: submit) {
                        Group {
                            if session.phase == .authenticating {
                                ProgressView().tint(TarsTheme.onFill)
                            } else {
                                Text("Sign in")
                                    .font(TarsTheme.Text.heading)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .background(canSubmit ? TarsTheme.paperBadge : TarsTheme.bg3)
                    .foregroundStyle(canSubmit ? TarsTheme.onFill : TarsTheme.inkTertiary)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .disabled(!canSubmit)
                    .animation(.easeOut(duration: 0.15), value: canSubmit)
                    .padding(.top, 6)
                }
                .frame(maxWidth: 420) // iPad: a column, never a stretched sheet
                .padding(.horizontal, 28)

                Spacer()

                // The honesty line — same promise as every other surface.
                Text("Simulated exchange. Real prices, practice money —\nthe same account as tarstrading.com.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 28)
            }
        }
        .onAppear { focus = .email }
    }

    private func submit() {
        focus = nil
        let e = email.trimmingCharacters(in: .whitespaces)
        let p = password
        Task { await session.signIn(email: e, password: p) }
    }

    // MARK: - Field styling (house inputs: bg2 wells, hairline, gold focus)

    private func field(_ label: String, text: Binding<String>, focused: Field) -> some View {
        TextField(label, text: text)
            .focused($focus, equals: focused)
            .modifier(WellStyle(active: focus == focused))
    }

    private func secureField(_ label: String, text: Binding<String>, focused: Field) -> some View {
        SecureField(label, text: text)
            .focused($focus, equals: focused)
            .modifier(WellStyle(active: focus == focused))
    }
}

private struct WellStyle: ViewModifier {
    let active: Bool
    func body(content: Content) -> some View {
        content
            .font(TarsTheme.Text.body)
            .foregroundStyle(TarsTheme.inkPrimary)
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(TarsTheme.bg2)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(active ? TarsTheme.paperBadge.opacity(0.5) : TarsTheme.hairline,
                                  lineWidth: 1)
            )
            .animation(.easeOut(duration: 0.15), value: active)
    }
}
