import { currentAdmin } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { userDetail } from "@/server/admin-ops";
import UserActions from "./user-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const d = await userDetail(id);
  return { title: d ? d.user.name : "User" };
}

const STARTING = 100_000;
const usd = (n: number) => "$" + Math.round(n).toLocaleString();
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function AdminUserDetail(props: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/app");
  const { id } = await props.params;
  const d = await userDetail(id);
  if (!d) notFound();

  const ret = d.account ? (d.account.equity - STARTING) / STARTING : null;

  return (
    <>
      <Link href="/admin/users" className="pressable font-mono text-[11px] text-ink-4 hover:text-ink-1">← Users</Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink-1">{d.user.name}</h1>
            <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${d.user.role === "admin" ? "text-agent" : "text-ink-4"}`}>{d.user.role}</span>
            {d.user.suspended && <span className="rounded-full bg-loss/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-loss">suspended</span>}
          </div>
          <p className="mt-0.5 text-xs text-ink-4">{d.user.email} · joined {when(d.user.createdAt)} · {d.sessions} live session{d.sessions === 1 ? "" : "s"}</p>
        </div>
      </div>

      <section className="panel mt-4 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Actions</p>
        <div className="mt-3">
          <UserActions id={d.user.id} role={d.user.role} suspended={d.user.suspended} isSelf={d.user.id === admin.id} />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Equity" value={d.account ? usd(d.account.equity) : "—"} />
        <Stat label="Return" value={ret != null ? `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%` : "—"} tone={ret == null ? "ink-2" : ret >= 0 ? "gain" : "loss"} />
        <Stat label="Cash" value={d.account ? usd(d.account.cash) : "—"} />
        <Stat label="Closed trades" value={String(d.counts.trades)} />
        <Stat label="Positions" value={String(d.positions.length)} />
        <Stat label="Analysts" value={String(d.agents.length)} />
        <Stat label="Alerts" value={String(d.counts.alerts)} />
        <Stat label="Academy" value={`${d.academy.lessonsDone}/${d.academy.totalLessons} · ${d.academy.xp}xp`} />
      </div>

      <TableCard title="Positions" cols={["Symbol", "Qty", "Avg entry"]}
        rows={d.positions.map((p) => [p.symbol, String(p.qty), usd(p.avgEntryPrice)])} empty="No open positions." />
      <TableCard title="Recent orders" cols={["When", "Side", "Type", "Symbol", "Qty", "Status"]}
        rows={d.orders.map((o) => [when(o.createdAt), o.side, o.type, o.symbol, String(o.qty), o.status])} empty="No orders." />
      <TableCard title="Analysts" cols={["Name", "Status", "Allocation"]}
        rows={d.agents.map((a) => [`${a.emoji} ${a.name}`, a.status, usd(a.allocation)])} empty="No analysts." />
      <TableCard title="Recent closes" cols={["When", "Symbol", "P&L"]}
        rows={d.journal.map((j) => [when(j.createdAt), j.symbol, j.pnl == null ? "—" : usd(j.pnl)])} empty="No closed trades." />
    </>
  );
}

function Stat({ label, value, tone = "ink-1" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 text-base font-semibold text-${tone}`}>{value}</p>
    </div>
  );
}

function TableCard({ title, cols, rows, empty }: { title: string; cols: string[]; rows: string[][]; empty: string }) {
  return (
    <>
      <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-4">{title}</h2>
      <section className="panel mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              {cols.map((c) => <th key={c} className="px-4 py-2.5">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-ink-4">{empty}</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-hairline last:border-0">
                {r.map((cell, j) => <td key={j} className="tnum px-4 py-2 text-ink-2 first:font-medium first:text-ink-1">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
