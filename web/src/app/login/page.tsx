"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthScene, { AuthField } from "@/components/auth-scene";

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
      router.push("/app/floor");
    } else {
      setError(data.error ?? "Couldn't log in.");
      setBusy(false);
    }
  }

  return (
    <AuthScene
      micro="Authenticated access"
      title="Welcome back"
      subtitle="The desk is exactly as you left it."
      sceneKicker="Tars Terminal"
      sceneHeading={<>The desk<br />is live.</>}
      sceneCopy="Your watchlists, positions, and analysts kept working the tape while you were gone. Sign back in and pick up the session."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AuthField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

        {error && (
          /* Fixed loss red — must read on the dark scene in both themes. */
          <p role="alert" className="rounded-lg border border-[oklch(0.67_0.185_22/0.4)] bg-[oklch(0.67_0.185_22/0.12)] px-3 py-2 text-sm text-[oklch(0.72_0.16_22)]">
            {error}
          </p>
        )}

        <button
          type="submit" disabled={busy}
          className="pressable cta-gold mt-2 min-h-12 rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-60"
        >
          {busy ? "Authenticating…" : "Enter the terminal"}
        </button>
        <p className="scene-ink-3 text-center text-xs">
          New here?{" "}
          <Link href="/join" className="-m-3 inline-block p-3 align-baseline text-gold hover:underline">Start with $100,000</Link>
        </p>
      </form>
    </AuthScene>
  );
}
