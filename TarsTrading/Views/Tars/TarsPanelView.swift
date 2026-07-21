import SwiftUI

/// The mentor's room: streaming chat with Tars. Works as a side panel or sheet.
struct TarsPanelView: View {
    @Environment(TarsStore.self) private var tars
    @Environment(TradingStore.self) private var trading
    @Environment(AcademyProgress.self) private var academy
    @State private var draft = ""
    @State private var showLetter = false
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(TarsTheme.hairline)
            conversation
            composer
        }
        .background(
            ZStack {
                TarsTheme.bg1
                TarsTheme.tarsAurora.opacity(0.5)
            }
            .ignoresSafeArea()
        )
        .sheet(isPresented: $showLetter) { TarsLetterView() }
    }

    private var header: some View {
        HStack(spacing: TarsTheme.Space.m) {
            TarsAvatar(size: 34, thinking: tars.isStreaming)
            VStack(alignment: .leading, spacing: 1) {
                Text("Tars")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(tars.isStreaming ? "thinking…" : "mentor · not a tipster")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .contentTransition(.opacity)
            }
            Spacer()
            Button { showLetter = true } label: {
                Image(systemName: "envelope")
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("The Sunday letter, your weekly review")
            if !tars.messages.isEmpty {
                Menu {
                    Button(role: .destructive) { tars.clearHistory() } label: {
                        Label("Clear conversation", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .accessibilityLabel("Conversation options")
            }
        }
        .padding(TarsTheme.Space.l)
    }

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: TarsTheme.Space.m) {
                    if tars.messages.isEmpty { emptyState }
                    ForEach(tars.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                            .transition(.asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .opacity))
                    }
                }
                .padding(TarsTheme.Space.l)
            }
            .onChange(of: tars.messages.last?.text) {
                if let last = tars.messages.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: TarsTheme.Space.l) {
            TarsAvatar(size: 64, thinking: false)
                .padding(.top, TarsTheme.Space.xxl)
            Text("Ask me anything about markets.\nI teach. I critique. I don't tip.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
            FlowChips(options: TarsStore.openers) { option in
                Task { await tars.send(option, trading: trading, academy: academy) }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var composer: some View {
        HStack(spacing: TarsTheme.Space.m) {
            TextField("Ask Tars…", text: $draft, axis: .vertical)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1...4)
                .focused($inputFocused)
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    Capsule().fill(TarsTheme.bg3)
                        .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1)))
                .onSubmit(sendDraft)

            Button(action: sendDraft) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(trimmedDraft.isEmpty ? TarsTheme.inkTertiary : TarsTheme.accent)
                    .symbolEffect(.bounce, value: tars.isStreaming)
            }
            .buttonStyle(PressableStyle())
            .disabled(trimmedDraft.isEmpty || tars.isStreaming)
            .accessibilityLabel("Send message")
        }
        .padding(TarsTheme.Space.l)
    }

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func sendDraft() {
        let text = trimmedDraft
        guard !text.isEmpty, !tars.isStreaming else { return }
        draft = ""
        Haptics.tap()
        Task { await tars.send(text, trading: trading, academy: academy) }
    }
}

// MARK: - Pieces

private struct MessageBubble: View {
    let message: TarsStore.Message

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.s) {
            if message.role == .user {
                // User: a quiet tinted capsule, trailing.
                Spacer(minLength: 40)
                Text(message.text.isEmpty ? "…" : message.text)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.vertical, TarsTheme.Space.m)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                            .fill(TarsTheme.selectionWash(TarsTheme.accent)))
                    .contentTransition(.numericText())
                    .accessibilityLabel("You: \(message.text.isEmpty ? "typing" : message.text)")
            } else {
                // Tars: no bubble — the mentor's words float on the room
                // itself, anchored by the mark. Reading type, not UI type.
                TarsAvatar(size: 24, thinking: false)
                    .padding(.top, 1)
                Text(message.text.isEmpty ? "…" : message.text)
                    .font(TarsTheme.Text.reading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentTransition(.numericText())
                    .accessibilityLabel("Tars: \(message.text.isEmpty ? "typing" : message.text)")
            }
        }
        .animation(Motion.ticker, value: message.text)
    }
}

/// Original mascot mark: an orbiting-ring monogram — deliberately NOT a
/// monolith (legal requirement: no Interstellar resemblance).
struct TarsAvatar: View {
    var size: CGFloat
    var thinking: Bool
    @State private var spin = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .fill(TarsTheme.tarsAurora)
                .overlay(Circle().strokeBorder(TarsTheme.accent.opacity(0.4), lineWidth: 1))
            Ellipse()
                .strokeBorder(TarsTheme.accent.opacity(0.8), lineWidth: max(1, size / 30))
                .frame(width: size * 1.1, height: size * 0.42)
                .rotationEffect(.degrees(spin ? 360 : 0))
            Circle()
                .fill(TarsTheme.accent)
                .frame(width: size * 0.16, height: size * 0.16)
        }
        .frame(width: size, height: size)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: thinking ? 1.6 : 9).repeatForever(autoreverses: false)) {
                spin = true
            }
        }
        .accessibilityHidden(true)
    }
}

/// Wrapping chip row used for suggested prompts.
private struct FlowChips: View {
    let options: [String]
    let action: (String) -> Void

    var body: some View {
        VStack(spacing: TarsTheme.Space.s) {
            ForEach(options, id: \.self) { option in
                Button { action(option) } label: {
                    Text(option)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.accent)
                        .padding(.horizontal, TarsTheme.Space.l)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(
                            Capsule().fill(TarsTheme.accent.opacity(0.12))
                                .overlay(Capsule().strokeBorder(TarsTheme.accent.opacity(0.3), lineWidth: 1)))
                }
                .buttonStyle(PressableStyle())
            }
        }
    }
}
