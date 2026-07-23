import "server-only";

/*
  The language-model client — one shared brain for the whole product. EVERY
  provider is spoken to through the SAME OpenAI-compatible `/v1/chat/completions`
  shape, so what you run locally and what you run in the cloud are byte-for-byte
  the same request — no behavior drift when you move to hosting.

  Providers, in precedence order (first one CONFIGURED wins; on failure the
  next is tried, so cloud-primary with a local/HF fallback just works):

  1. Cloud — any OpenAI-compatible endpoint: Groq, DeepInfra, Together,
     Fireworks, OpenAI, etc. Set OPENAI_BASE_URL + OPENAI_API_KEY + OPENAI_MODEL.
     This is what you'll host with; set it and local == cloud.
  2. Ollama — local inference via its OpenAI-compatible /v1 endpoint. Free,
     private, 24/7. Set OLLAMA_URL (+ OLLAMA_MODEL).
  3. Hugging Face router — hosted open models. Set HF_TOKEN.
  4. none — callers use their own scripted fallback.
*/

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type ProviderName = "cloud" | "ollama" | "hf" | "scripted";
export type ProviderStatus = { provider: ProviderName; model: string };

type Provider = {
  name: ProviderName;
  /** OpenAI-compatible base, WITHOUT the trailing /chat/completions. */
  baseUrl: string;
  apiKey: string; // "" for keyless local Ollama
  model: string;
};

const strip = (u: string) => u.replace(/\/$/, "");

/** The configured providers, highest precedence first. */
function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_API_KEY) {
    list.push({
      name: "cloud",
      baseUrl: strip(process.env.OPENAI_BASE_URL),
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "llama-3.3-70b-versatile",
    });
  }
  if (process.env.OLLAMA_URL) {
    list.push({
      name: "ollama",
      baseUrl: `${strip(process.env.OLLAMA_URL)}/v1`,
      apiKey: "",
      model: process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct",
    });
  }
  if (process.env.HF_TOKEN) {
    list.push({
      name: "hf",
      baseUrl: "https://router.huggingface.co/v1",
      apiKey: process.env.HF_TOKEN,
      model: process.env.TARS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct",
    });
  }
  return list;
}

/** The active provider (first configured) — what the admin dashboard reports. */
export function brainStatus(): ProviderStatus {
  const p = providers()[0];
  return p ? { provider: p.name, model: p.model } : { provider: "scripted", model: "rules" };
}

function headers(p: Provider): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (p.apiKey) h.Authorization = `Bearer ${p.apiKey}`;
  return h;
}

async function complete(p: Provider, messages: ChatMsg[], maxTokens: number): Promise<string | null> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(p),
    body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature: 0.6, stream: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

/** Non-streaming completion. Tries providers in order; null if all fail. */
export async function callModel(messages: ChatMsg[], maxTokens = 400): Promise<string | null> {
  for (const p of providers()) {
    try {
      const out = await complete(p, messages, maxTokens);
      if (out != null) return out;
    } catch { /* fall through to the next configured provider */ }
  }
  return null;
}

/** OpenAI-compatible SSE streaming from the primary provider. Null if none
    configured. (No mid-stream failover — the caller yields a scripted line if
    the stream dies.) */
export function streamModel(messages: ChatMsg[]): AsyncGenerator<string> | null {
  const p = providers()[0];
  if (!p) return null;

  async function* gen(): AsyncGenerator<string> {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers(p),
      body: JSON.stringify({ model: p.model, messages, max_tokens: 600, temperature: 0.6, stream: true }),
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
