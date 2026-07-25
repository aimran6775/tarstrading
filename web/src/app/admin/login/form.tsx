"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TarsWordmark from "@/components/tars-wordmark";

/*
  The control-console sign-in. Deliberately NOT the product's login: a fixed
  dark operations room, a machined plate, mono labels, violet (the control
  accent) instead of gold. This is where the platform is run from, and it
  should feel like a facility door, not a marketing page.
*/

const ROOM = "oklch(0.13 0.02 280)";
const PLATE = "oklch(0.17 0.022 280 / 0.86)";
const FIELD = "oklch(0.21 0.024 278 / 0.75)";

export default function ConsoleLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/console-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) { router.replace("/admin"); router.refresh(); }
      else setError(data.error ?? "Sign-in failed.");
    } catch {
      setError("Couldn't reach the console service.");
    } finally { setBusy(false); }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: ROOM }}>
      {/* the room: a violet control glow + a faint machine grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, oklch(0.70 0.16 300 / 0.18), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />

      <section className="relative w-full max-w-[400px] rounded-2xl border border-white/10 p-7 sm:p-8"
        style={{ background: PLATE, backdropFilter: "blur(16px)", boxShadow: "0 30px 80px -20px oklch(0 0 0 / 0.7)" }}>
        {/* violet thread — the control-center signature */}
        <div aria-hidden className="absolute inset-x-8 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.70 0.16 300), transparent)" }} />

        <div className="flex flex-col items-center text-center">
          <span className="[&_span]:text-[oklch(0.96_0.008_264)]"><TarsWordmark size={22} text="TARS TRADING" /></span>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[oklch(0.70_0.16_300)]">
            Control Center
          </p>
          <h1 className="mt-1.5 text-lg font-semibold text-[oklch(0.96_0.008_264)]">Operator sign-in</h1>
          <p className="mt-1 text-xs text-[oklch(0.68_0.018_264)]">
            Restricted. This console runs the platform.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          <Field label="Username" value={username} onChange={setUsername}
            autoComplete="username" autoFocus />
          <Field label="Password" value={password} onChange={setPassword}
            type="password" autoComplete="current-password" />

          {error && (
            <p role="alert" className="rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "oklch(0.67 0.185 22 / 0.45)",
                background: "oklch(0.67 0.185 22 / 0.12)",
                color: "oklch(0.78 0.15 22)",
              }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !username || !password}
            className="pressable mt-1 min-h-12 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, oklch(0.70 0.16 300), oklch(0.58 0.17 300))",
              color: "oklch(0.99 0 0)",
              boxShadow: "0 1px 0 oklch(1 0 0 / 0.25) inset, 0 14px 40px -14px oklch(0.58 0.17 300)",
            }}>
            {busy ? "Verifying…" : "Enter the control center"}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[oklch(0.55_0.02_264)]">
          Every action here is logged
        </p>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", ...rest }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  autoComplete?: string; autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.68_0.018_264)]">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-xl border border-white/10 px-3.5 text-base outline-none transition-colors focus:border-[oklch(0.70_0.16_300)]"
        style={{ background: FIELD, color: "oklch(0.96 0.008 264)" }}
        {...rest}
      />
    </label>
  );
}
