"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthScene, { AuthField } from "@/components/auth-scene";

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
      router.push("/app/floor?welcome=1");
    } else {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <AuthScene
      micro="New operator"
      title={<>Your <span className="tnum text-gold">$100,000</span> is waiting</>}
      subtitle="Simulated capital. Real market data. Real learning."
      sceneKicker="Open a desk"
      sceneHeading={<>Take<br />the desk.</>}
      sceneCopy="A hundred thousand in simulated capital, a terminal that behaves like the real thing, and an academy that starts at zero. Every fill is practice — that's the point."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AuthField label="Name" type="text" value={name} onChange={setName} autoComplete="name" />
        <AuthField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters" />

        {error && (
          /* Fixed loss red — must read on the dark scene in both themes. */
          <p role="alert" className="rounded-lg border border-[oklch(0.67_0.185_22/0.4)] bg-[oklch(0.67_0.185_22/0.12)] px-3 py-2 text-sm text-[oklch(0.72_0.16_22)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="pressable cta-gold mt-2 min-h-12 rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-60"
        >
          {busy ? "Opening your account…" : "Open my account"}
        </button>
        <p className="scene-ink-3 text-center text-xs">
          Already trading?{" "}
          <Link href="/login" className="-m-3 inline-block p-3 align-baseline text-gold hover:underline">Log in</Link>
        </p>
      </form>
    </AuthScene>
  );
}
