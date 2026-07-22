import Link from "next/link";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";

/*
  Landing v1 — typographic and dramatic. The full 3D hero and scroll scenes
  land in Act II; this page already carries the voice, the badge, and the
  $100k promise.
*/
export default async function Landing() {
  const user = await currentUser();
  if (user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-3 md:px-10">
        <div className="flex items-center gap-3">
          <OrbMark />
          <span className="text-sm font-semibold tracking-wide text-ink-1">Tars Trading</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="pressable rounded-full px-4 py-2 text-sm text-ink-2 hover:text-ink-1"
          >
            Log in
          </Link>
          <Link
            href="/join"
            className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-onfill"
          >
            Start with $100k
          </Link>
        </nav>
      </header>

      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 45% at 50% 0%, oklch(from var(--accent) l c h / 0.14), transparent 70%)",
          }}
        />
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-amber">
          <span className="badge-dot h-1.5 w-1.5 rounded-full bg-amber" />
          SIMULATED MONEY — THAT&apos;S THE POINT
        </div>

        <h1 className="max-w-4xl text-balance text-5xl font-bold leading-[1.05] tracking-tight text-ink-1 md:text-7xl">
          The terminal that
          <span className="text-accent"> teaches.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-ink-2 md:text-xl">
          Join with <span className="tnum font-semibold text-ink-1">$100,000</span> in
          simulated capital. Learn everything about markets from an AI mentor.
          Then program trading agents that do exactly what you tell them —
          and nothing else.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/join"
            className="pressable rounded-full bg-accent px-8 py-4 text-base font-semibold text-onfill shadow-[0_10px_40px_-10px_var(--accent)]"
          >
            Claim your $100,000
          </Link>
          <Link
            href="/login"
            className="pressable rounded-full border border-hairline px-8 py-4 text-base text-ink-2 hover:text-ink-1"
          >
            I have an account
          </Link>
        </div>

        <p className="mt-8 text-xs text-ink-3">
          Education, not investment advice. Simulated results never promise real ones.
        </p>
      </section>

      <section className="grid gap-4 px-6 pb-24 md:grid-cols-3 md:px-10">
        {[
          {
            title: "Trade like it's real",
            body: "Real market data, honest fills, a professional terminal — with a badge that never lets you forget it's practice.",
          },
          {
            title: "Learn everything",
            body: "Six tracks from candlesticks to options greeks, taught in plain language by Tars — a mentor who critiques, never tips.",
          },
          {
            title: "Deploy your agents",
            body: "Program as many trading agents as you want. They backtest honestly, trade your simulated book, and narrate every decision.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-6">
            <h3 className="text-base font-semibold text-ink-1">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-hairline px-6 py-8 text-center text-xs text-ink-3">
        Tars Trading is an educational simulator. No real money, no brokerage services,
        no investment advice. Markets are hard — practice here first.
      </footer>
    </main>
  );
}

function OrbMark() {
  return (
    <span className="relative inline-flex h-7 w-7 items-center justify-center">
      <span className="absolute inset-0 rounded-full border border-accent/40 bg-accent/10" />
      <span className="absolute h-[38%] w-[110%] rounded-[50%] border border-accent/70" />
      <span className="h-1 w-1 rounded-full bg-accent" />
    </span>
  );
}
