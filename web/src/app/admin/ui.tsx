/*
  Shared presentational kit for the admin control center. Pure server
  components — no state, no client bundle. Semantic color is reserved for
  meaning: gain = healthy/up, loss = broken/down, gold = attention/manual hold.
*/

type Tone = "default" | "gain" | "loss" | "warn" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-ink-1", gain: "text-gain", loss: "text-loss", warn: "text-gold", accent: "text-agent",
};

/** A single headline metric. `tone` colors the value when it carries meaning. */
export function StatCard({ label, value, sub, tone = "default" }: {
  label: string; value: string | number; sub?: string; tone?: Tone;
}) {
  return (
    <div className="panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-4">{sub}</p>}
    </div>
  );
}

const DOT: Record<"ok" | "warn" | "crit", string> = {
  ok: "bg-gain", warn: "bg-gold", crit: "bg-loss",
};

/** A status pill: colored dot + label + detail. Used for platform signals. */
export function StatusChip({ level, label, detail }: { level: "ok" | "warn" | "crit"; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-hairline bg-bg2 px-3 py-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[level]} ${level !== "ok" ? "animate-pulse" : ""}`} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-3">{label}</span>
      <span className={`font-mono text-[10px] ${level === "crit" ? "text-loss" : level === "warn" ? "text-gold" : "text-ink-4"}`}>{detail}</span>
    </div>
  );
}

export function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-baseline justify-between gap-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">{children}</h2>
      {right}
    </div>
  );
}

/** The page title bar — dense mono label, optional right-aligned action slot. */
export function PageHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">{title}</h1>
      {right}
    </div>
  );
}

type Col = { label: string; align?: "right" };

/*
  The shared table chrome for static rows — one rounded panel, hairline rules,
  a row hover. Cells are ReactNode, so callers still drop in colored status
  spans; the first column reads as the row's subject (medium, ink-1).
*/
export function DataTable({ cols, rows, empty, minWidth }: {
  cols: Col[]; rows: React.ReactNode[][]; empty: string; minWidth?: number;
}) {
  return (
    <section className="panel mt-2 overflow-x-auto">
      <table className="w-full text-left text-xs" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
            {cols.map((c, i) => <th key={i} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-ink-4">{empty}</td></tr>}
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-hairline last:border-0 hover:bg-bg3/30">
              {r.map((cell, ci) => (
                <td key={ci} className={`tnum px-4 py-2 ${cols[ci]?.align === "right" ? "text-right" : ""} ${ci === 0 ? "font-medium text-ink-1" : "text-ink-2"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/*
  A dependency-free sparkline. Normalizes `data` into a 100×28 viewBox with a
  soft area fill under the agent-colored stroke and an emphasized endpoint —
  the same care a real chart gets, at glance size.
*/
export function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  const w = 100, h = 28, pad = 2;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const lastX = x(n - 1), lastY = y(data[n - 1] ?? 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={area} fill="var(--agent)" opacity={0.12} />
      <path d={line} fill="none" stroke="var(--agent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r={1.8} fill="var(--agent)" />
    </svg>
  );
}
