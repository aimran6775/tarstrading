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
    @State private var showStarters = false
    @State private var pulse = false
    @FocusState private var writing: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            transcript
        }
            .background(TarsTheme.bg0)
            // The composer rides the safe area so the keyboard and the tab bar
            // both move it correctly, instead of a VStack fighting them.
            .safeAreaInset(edge: .bottom) { composer }
            .toolbar(.hidden, for: .navigationBar)
            .task { if model.messages.isEmpty { await model.load() } }
    }

    /// The screen owns its header, like Markets and Desk — and it says
    /// WHO you're talking to, not just what the screen is called.
    private var header: some View {
        HStack(alignment: .center, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Your desk manager")
                    .font(TarsTheme.Text.screenTitle)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text("Reads your book · can hire and retire analysts")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer()
            if !model.messages.isEmpty {
                Button {
                    Haptics.tap()
                    showStarters = true
                } label: {
                    Image(systemName: "lightbulb")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(TarsTheme.bg1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Suggested questions")
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.top, TarsTheme.Space.s)
        .padding(.bottom, TarsTheme.Space.m)
        .background(TarsTheme.bg0)
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
                        HStack(spacing: 5) {
                            ForEach(0..<3, id: \.self) { i in
                                Circle().fill(TarsTheme.inkTertiary)
                                    .frame(width: 6, height: 6)
                                    .opacity(pulse ? 1 : 0.25)
                                    .animation(.easeInOut(duration: 0.6)
                                        .repeatForever().delay(Double(i) * 0.18), value: pulse)
                            }
                            Text("Reading your book…")
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(TarsTheme.inkTertiary)
                                .padding(.leading, 4)
                        }
                        .onAppear { pulse = true }
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
            .sheet(isPresented: $showStarters) {
                startersSheet
                    .presentationDetents([.height(320)])
                    .presentationBackground(TarsTheme.bg1)
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
        return HStack(alignment: .bottom, spacing: 6) {
            if mine { Spacer(minLength: 56) }
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
            if !mine { Spacer(minLength: 56) }
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .overlay(alignment: mine ? .bottomTrailing : .bottomLeading) {
            if let t = m.createdAt {
                Text(Date(timeIntervalSince1970: t / 1000), style: .time)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(TarsTheme.inkQuaternary)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .offset(y: 11)
            }
        }
        .padding(.bottom, m.createdAt != nil ? 12 : 0)
    }

    /// The starters, on demand — a beginner's way back in when the
    /// transcript has scrolled past the point of knowing what to ask.
    private var startersSheet: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Ask your desk")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            ForEach(Self.starters, id: \.self) { s in
                Button {
                    showStarters = false
                    Haptics.tap()
                    Task { await model.send(s) }
                } label: {
                    Text(s)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(TarsTheme.Space.m)
                        .background(TarsTheme.bg2)
                        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(TarsTheme.Space.xl)
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
