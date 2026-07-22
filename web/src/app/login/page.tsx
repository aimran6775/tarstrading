"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push("/app");
    } else {
      setError(data.error ?? "Couldn't log in.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-ink-1">
          Welcome back
        </h1>
        <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" required
              className="rounded-lg border border-hairline bg-bg1 px-3.5 py-3 text-ink-1 outline-none transition focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required
              className="rounded-lg border border-hairline bg-bg1 px-3.5 py-3 text-ink-1 outline-none transition focus:border-gold"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={busy}
            className="pressable cta-gold mt-2 rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-60"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
          <p className="text-center text-xs text-ink-3">
            New here?{" "}
            <Link href="/join" className="text-gold hover:underline">Start with $100,000</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
