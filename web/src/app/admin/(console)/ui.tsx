import Link from "next/link";

/*
  The control-center design system — the console's whole vocabulary in one
  file. Pure server components: no state, no client bundle, no hooks.

  Rules of the kit:
  · Labels are mono, uppercase, wide-tracked. They are machine labels, not prose.
  · Numbers are tabular (.tnum) and right-aligned wherever they're compared.
  · Semantic color is strictly for MEANING — gain = healthy/up, loss = broken/
    down, gold = needs attention. Violet (agent) is the console's own identity
    accent: navigation and control affordances, never data.
  · Density over decoration. Hairlines, not boxes inside boxes.
*/

type Tone = "default" | "gain" | "loss" | "warn" | "accent" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-ink-1",
  gain: "text-gain",
  loss: "text-loss",
  warn: "text-gold",
  accent: "text-agent",
  muted: "text-ink-4",
};

const TONE_CHIP: Record<Tone, string> = {
  default: "border-hairline bg-bg2 text-ink-2",
  gain: "border-gain/35 bg-gain/10 text-gain",
  loss: "border-loss/35 bg-loss/10 text-loss",
  warn: "border-gold/35 bg-gold/10 text-gold",
  accent: "border-agent/35 bg-agent/10 text-agent",
  muted: "border-hairline bg-transparent text-ink-4",
};

const TONE_DOT: Record<Tone, string> = {
  default: "bg-ink-3", gain: "bg-gain", loss: "bg-loss",
  warn: "bg-gold", accent: "bg-agent", muted: "bg-ink-4",
};

/* ============================================================
   READOUTS
   ============================================================ */

/*
  A single headline metric. The label is a machine tag, the value is tabular and
  quiet unless it carries meaning. `delta` sits alongside the value for a
  change/rate; `right` takes a glance-sized visual (a Sparkline, a Badge).
*/
export function StatCard({ label, value, sub, tone = "default", delta, deltaTone, right, href }: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  tone?: Tone;
  delta?: React.ReactNode;
  deltaTone?: Tone;
  right?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] leading-4 uppercase tracking-[0.2em] text-ink-4">{label}</p>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={`tnum text-[1.55rem] leading-none font-semibold tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>
        {delta != null && (
          <span className={`tnum text-[11px] font-medium ${TONE_TEXT[deltaTone ?? tone]}`}>{delta}</span>
        )}
      </div>
      {sub && <p className="mt-1.5 text-[11px] leading-4 text-ink-4">{sub}</p>}
    </>
  );

  const base = "panel flex flex-col p-4";
  return href
    ? <Link href={href} className={`${base} transition-colors hover:bg-bg2`}>{body}</Link>
    : <div className={base}>{body}</div>;
}

/*
  The deck's monumental number — one per view, the figure you'd read out loud
  on a call. Fluid so it survives 375px without wrapping; children take a row of
  supporting <Field>s.
*/
export function HeroMetric({ label, value, sub, tone = "default", children }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">{label}</p>
      <p className={`tnum mt-2 leading-none font-semibold tracking-tight ${TONE_TEXT[tone]}`}
        style={{ fontSize: "clamp(2.25rem, 7vw, 3.75rem)" }}>
        {value}
      </p>
      {sub && <p className="mt-2.5 text-[13px] text-ink-3">{sub}</p>}
      {children}
    </div>
  );
}

/** A label→value pair — the console's atomic readout, for dense clusters. */
export function Field({ label, value, sub, tone = "default", className = "" }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 truncate text-sm font-medium ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-ink-4">{sub}</p>}
    </div>
  );
}

/*
  A row in a list panel: subject on the left, figure on the right. Becomes a
  link when `href` is given, and always clears the 44px touch floor.
*/
export function MetricRow({ label, sub, value, valueSub, tone = "default", lead, href }: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  valueSub?: React.ReactNode;
  tone?: Tone;
  lead?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      {lead && <span className="shrink-0">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-1">{label}</span>
        {sub && <span className="mt-0.5 block truncate text-[11px] text-ink-4">{sub}</span>}
      </span>
      {value != null && (
        <span className="shrink-0 text-right">
          <span className={`tnum block text-[13px] font-medium ${TONE_TEXT[tone]}`}>{value}</span>
          {valueSub && <span className="tnum mt-0.5 block text-[10px] text-ink-4">{valueSub}</span>}
        </span>
      )}
    </>
  );

  const base = "flex min-h-11 items-center gap-3 px-4 py-2.5";
  return href
    ? <Link href={href} className={`${base} transition-colors hover:bg-bg3/40`}>{inner}</Link>
    : <div className={base}>{inner}</div>;
}

/* ============================================================
   SIGNALS
   ============================================================ */

const DOT: Record<"ok" | "warn" | "crit", string> = {
  ok: "bg-gain", warn: "bg-gold", crit: "bg-loss",
};
const RING: Record<"ok" | "warn" | "crit", string> = {
  ok: "border-hairline bg-bg2",
  warn: "border-gold/35 bg-gold/8",
  crit: "border-loss/40 bg-loss/10",
};
const DETAIL: Record<"ok" | "warn" | "crit", string> = {
  ok: "text-ink-4", warn: "text-gold", crit: "text-loss",
};

/** A status pill: colored dot + label + detail. Used for platform signals. */
export function StatusChip({ level, label, detail }: {
  level: "ok" | "warn" | "crit"; label: string; detail: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${RING[level]}`}>
      <span aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[level]} ${level !== "ok" ? "animate-pulse" : ""}`} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-3">{label}</span>
      <span className={`tnum text-[10px] ${DETAIL[level]}`}>{detail}</span>
    </div>
  );
}

/** A small mono tag — states, kinds, flags. Inline, never a button. */
export function Badge({ children, tone = "default", dot = false, className = "" }: {
  children: React.ReactNode; tone?: Tone; dot?: boolean; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap ${TONE_CHIP[tone]} ${className}`}>
      {dot && <span aria-hidden className={`h-1 w-1 shrink-0 rounded-full ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

/* ============================================================
   STRUCTURE
   ============================================================ */

/*
  A section rule: mono label, then a hairline running to the right-hand slot.
  The line is what makes a long ops page scannable.
*/
export function SectionHeader({ children, right }: {
  children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="mt-9 flex items-center gap-3">
      <h2 className="shrink-0 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">{children}</h2>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-hairline" />
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** The page title bar — dense mono label, optional right-aligned action slot. */
export function PageHeader({ title, right, sub }: {
  title: string; right?: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-hairline pb-4">
      <div className="min-w-0">
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-3">{title}</h1>
        {sub && <p className="mt-1.5 text-[13px] text-ink-4">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/** A control strip — filters, scopes, one-shot actions above a table. */
export function Toolbar({ children, right }: {
  children?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[var(--r-m)] border border-hairline bg-bg1 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/** Nothing here — said plainly, with the reason and the way out. */
export function EmptyState({ title, hint, icon }: {
  title: string; hint?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ?? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink-4 opacity-60" aria-hidden fill="none"
          stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 3" />
          <path d="M9 12h6" />
        </svg>
      )}
      <p className="text-[13px] font-medium text-ink-2">{title}</p>
      {hint && <p className="max-w-sm text-[11px] leading-5 text-ink-4">{hint}</p>}
    </div>
  );
}

/* ============================================================
   TABLE
   ============================================================ */

type Col = { label: string; align?: "right" };

/*
  The shared table chrome for static rows — one rounded panel, a sticky header,
  hairline rules and a hover wash (no zebra: the rules already carry the eye).
  Cells are ReactNode, so callers still drop in colored status spans; the first
  column reads as the row's subject, right-aligned columns get tabular figures.

  Wide tables scroll INSIDE the panel — the page body never scrolls sideways.
*/
export function DataTable({ cols, rows, empty, minWidth, dense = false, maxHeight }: {
  cols: Col[];
  rows: React.ReactNode[][];
  empty: string;
  minWidth?: number;
  dense?: boolean;
  maxHeight?: number;
}) {
  // With no explicit minWidth, give many-column tables a sane floor (~110px/col)
  // so they scroll rather than squish on phones.
  const floor = minWidth ?? (cols.length >= 5 ? cols.length * 110 : undefined);
  const cell = dense ? "px-3 py-1.5" : "px-4 py-2.5";

  return (
    <section className="panel mt-2 overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain"
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        <table className="w-full text-left text-xs" style={floor ? { minWidth: floor } : undefined}>
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              {cols.map((c, i) => (
                <th key={i} scope="col"
                  className={`sticky top-0 z-10 border-b border-hairline bg-bg1 font-medium ${cell} ${c.align === "right" ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length}><EmptyState title={empty} /></td>
              </tr>
            )}
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-hairline transition-colors last:border-0 hover:bg-bg3/40">
                {r.map((c, ci) => (
                  <td key={ci}
                    className={`${dense ? "px-3 py-1" : "px-4 py-2"} ${
                      cols[ci]?.align === "right" ? "tnum text-right" : ""
                    } ${ci === 0 ? "font-medium text-ink-1" : "text-ink-2"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================================================
   GLANCE CHART
   ============================================================ */

const STROKE: Record<"agent" | "gain" | "loss" | "gold" | "ink", string> = {
  agent: "var(--agent)", gain: "var(--gain)", loss: "var(--loss)",
  gold: "var(--gold)", ink: "var(--ink-3)",
};

/*
  A dependency-free sparkline. Normalizes `data` into a 100×28 viewBox with a
  soft area fill under the stroke and an emphasized endpoint — the same care a
  real chart gets, at glance size.
*/
export function Sparkline({ data, className = "", tone = "agent" }: {
  data: number[]; className?: string; tone?: "agent" | "gain" | "loss" | "gold" | "ink";
}) {
  const w = 100, h = 28, pad = 2;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const lastX = x(n - 1), lastY = y(data[n - 1] ?? 0);
  const c = STROKE[tone];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={area} fill={c} opacity={0.12} />
      <path d={line} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
        vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r={1.8} fill={c} />
    </svg>
  );
}
