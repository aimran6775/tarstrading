import SwiftUI

/*
  The assistant — your desk manager, as a conversation.

  It knows the risk book: equity, requirement, SPAN credits, the live
  financing rates with the arithmetic already done. Ask it what \$50,000 of
  margin costs a day and it reads the number rather than dividing badly.
  It can also ACT — hire an analyst, pause one, retire one — so a reply
  sometimes means the floor changed underneath you.
*/
struct AssistantView: View {
    @State private var model = AssistantModel()
    @State private var draft = ""
    @FocusState private var writing: Bool

    var body: some View {
        transcript
            .background(TarsTheme.bg0)
            // The composer rides the safe area so the keyboard and the tab bar
            // both move it correctly, instead of a VStack fighting them.
            .safeAreaInset(edge: .bottom) { composer }
            .navigationTitle("Assistant")
            .navigationBarTitleDisplayMode(.inline)
            // Without an opaque bar the transcript reads THROUGH the title.
            .toolbarBackground(TarsTheme.bg0, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .task { if model.messages.isEmpty { await model.load() } }
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                    if model.messages.isEmpty && model.loaded {
                        opener
                    }
                    ForEach(model.messages) { m in
                        bubble(m).id(m.id)
                    }
                    if model.thinking {
                        HStack(spacing: 6) {
                            ProgressView().tint(TarsTheme.inkTertiary).scaleEffect(0.7)
                            Text("Reading your book…")
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(TarsTheme.inkTertiary)
                        }
                        .padding(.horizontal, TarsTheme.Space.l)
                        .id("thinking")
                    }
                }
                .padding(.top, TarsTheme.Space.xl)
                .padding(.bottom, TarsTheme.Space.l)
            }
            .onChange(of: model.messages.count) { _, _ in
                withAnimation { proxy.scrollTo(model.messages.last?.id, anchor: .bottom) }
            }
            .onChange(of: model.thinking) { _, on in
                if on { withAnimation { proxy.scrollTo("thinking", anchor: .bottom) } }
            }
        }
    }

    /// What to ask when you don't know what to ask.
    private var opener: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Your desk manager")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("It reads your risk book — equity, requirement, financing — and can hire, pause or retire analysts on your word.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            ForEach(Self.starters, id: \.self) { s in
                Button {
                    Haptics.tap()
                    Task { await model.send(s) }
                } label: {
                    Text(s)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.paperBadge)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(TarsTheme.Space.m)
                        .background(TarsTheme.paperBadge.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
    }

    static let starters = [
        "How much buying power do I have, and what would $50,000 of margin cost me a day?",
        "Explain my current risk in plain English.",
        "What's the difference between initial and maintenance margin?",
    ]

    private func bubble(_ m: AssistantMessage) -> some View {
        let mine = m.role == "user"
        return HStack {
            if mine { Spacer(minLength: 48) }
            Text(m.text)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .textSelection(.enabled)
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.vertical, TarsTheme.Space.m)
                .background(mine ? TarsTheme.accent.opacity(0.16) : TarsTheme.bg2)
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                    .strokeBorder(mine ? TarsTheme.accent.opacity(0.35) : .clear, lineWidth: 1))
            if !mine { Spacer(minLength: 48) }
        }
        .padding(.horizontal, TarsTheme.Space.l)
    }

    private var composer: some View {
        HStack(spacing: TarsTheme.Space.m) {
            TextField("Ask your desk…", text: $draft, axis: .vertical)
                .focused($writing)
                .lineLimit(1...5)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.vertical, 12)
                .background(TarsTheme.bg2)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            Button {
                let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { return }
                draft = ""
                Haptics.tap()
                Task { await model.send(text) }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(canSend ? TarsTheme.onFill : TarsTheme.inkTertiary)
                    .frame(width: 44, height: 44)
                    .background(canSend ? TarsTheme.paperBadge : TarsTheme.bg3)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityLabel("Send")
        }
        .padding(TarsTheme.Space.l)
        .background(TarsTheme.bg1)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.thinking
    }
}

@Observable @MainActor
final class AssistantModel {
    private(set) var messages: [AssistantMessage] = []
    private(set) var thinking = false
    private(set) var loaded = false
    private let api = TarsAPIClient.shared

    func load() async {
        messages = (try? await api.assistantHistory()) ?? []
        loaded = true
    }

    func send(_ text: String) async {
        // Optimistic echo so the conversation never feels like it swallowed you.
        messages.append(.init(id: UUID().uuidString, role: "user", text: text, createdAt: nil))
        thinking = true
        defer { thinking = false }
        if (try? await api.assistantSay(text)) != nil {
            // Reload rather than append: the turn may have ACTED on the floor,
            // and the server's transcript is the record of what really happened.
            await load()
        } else {
            messages.append(.init(id: UUID().uuidString, role: "assistant",
                                  text: "I couldn't reach the desk just now. Try again in a moment.",
                                  createdAt: nil))
        }
    }
}
