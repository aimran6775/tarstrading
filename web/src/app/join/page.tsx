"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

/** The $100k moment starts here. */
export default function Join() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push("/app?welcome=1");
    } else {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="kicker mb-5">Simulated capital</p>
          <h1 className="display text-3xl text-ink-1 md:text-4xl">
            Your <span className="tnum">$100,000</span> is waiting
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Simulated capital. Real market data. Real learning.
          </p>
        </div>

        <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
          <Field label="Name" type="text" value={name} onChange={setName} autoComplete="name" />
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters" />

          {error && (
            <p role="alert" className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="pressable cta-gold mt-2 rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-60"
          >
            {busy ? "Opening your account…" : "Open my account"}
          </button>
          <p className="text-center text-xs text-ink-3">
            Already trading?{" "}
            <Link href="/login" className="text-gold hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field(props: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{props.label}</span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required
        className="rounded-lg border border-hairline bg-bg1 px-3.5 py-3 text-ink-1 outline-none transition focus:border-gold"
      />
      {props.hint && <span className="text-xs text-ink-4">{props.hint}</span>}
    </label>
  );
}
