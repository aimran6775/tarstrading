import "server-only";

/*
  The language-model client — one shared brain for the whole product (the
  assistant, and any explainer text). Provider is auto-detected, Ollama first:

  - OLLAMA_URL set → local inference (default qwen2.5:7b-instruct). Free,
    private, 24/7, no per-token cost — the primary path.
  - HF_TOKEN set   → Hugging Face router (OpenAI-compatible). Used as a
    FALLBACK if Ollama is configured but unreachable, or on its own.
  - neither        → callers use their own scripted fallback.

  callModel tries the chain in order, so during setup (Ollama not installed
  yet) the app quietly uses HF, then switches to local the moment Ollama is up
  — no redeploy, no config flip.
*/

const OLLAMA_URL = process.env.OLLAMA_URL ?? "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";
const HF_TOKEN = process.env.HF_TOKEN ?? "";
const HF_MODEL = process.env.TARS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type Provider = "ollama" | "hf" | "scripted";

export function brainStatus(): { provider: Provider; model: string } {
  if (OLLAMA_URL) return { provider: "ollama", model: OLLAMA_MODEL };
  if (HF_TOKEN) return { provider: "hf", model: HF_MODEL };
  return { provider: "scripted", model: "rules" };
}

const base = (u: string) => u.replace(/\/$/, "");

async function callOllama(messages: ChatMsg[], maxTokens: number): Promise<string | null> {
  const res = await fetch(`${base(OLLAMA_URL)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.6 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? null;
}

async function callHF(messages: ChatMsg[], maxTokens: number): Promise<string | null> {
  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: HF_MODEL, messages, max_tokens: maxTokens, temperature: 0.6 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`hf ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

/** Non-streaming completion. Tries Ollama, then HF; null if all fail. */
export async function callModel(messages: ChatMsg[], maxTokens = 400): Promise<string | null> {
  if (OLLAMA_URL) {
    try { return await callOllama(messages, maxTokens); }
    catch { /* fall through to HF during setup / on local outage */ }
  }
  if (HF_TOKEN) {
    try { return await callHF(messages, maxTokens); }
    catch { return null; }
  }
  return null;
}

/** OpenAI-compatible SSE streaming. Returns null if no provider is configured.
    Streams from Ollama when set, else HF. (No mid-stream failover — the caller
    yields a scripted line if the stream dies.) */
export function streamModel(messages: ChatMsg[]): AsyncGenerator<string> | null {
  const useOllama = !!OLLAMA_URL;
  const endpoint = useOllama
    ? `${base(OLLAMA_URL)}/v1/chat/completions`
    : HF_TOKEN ? "https://router.huggingface.co/v1/chat/completions" : null;
  if (!endpoint) return null;
  const model = useOllama ? OLLAMA_MODEL : HF_MODEL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!useOllama && HF_TOKEN) headers.Authorization = `Bearer ${HF_TOKEN}`;

  async function* gen(): AsyncGenerator<string> {
    const res = await fetch(endpoint!, {
      method: "POST", headers,
      body: JSON.stringify({ model, messages, max_tokens: 600, temperature: 0.6, stream: true }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* keep-alive / partial line */ }
      }
    }
  }
  return gen();
}
