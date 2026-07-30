import { currentAdmin } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { userDetail } from "@/server/admin-ops";
import { StatCard, SectionHeader, DataTable } from "../../ui";
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
          <UserActions id={d.user.id} role={d.user.role} suspended={d.user.suspended} isSelf={d.user.id === admin.id}
            name={d.user.name} email={d.user.email} note={d.user.adminNote} />
        </div>
      </section>

      {/* Trading book */}
      <SectionHeader>Trading book</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Equity" value={d.account ? usd(d.account.equity) : "—"} tone="accent" />
        <StatCard label="Return" value={ret != null ? `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%` : "—"} tone={ret == null ? "default" : ret >= 0 ? "gain" : "loss"} />
        <StatCard label="Cash" value={d.account ? usd(d.account.cash) : "—"} />
        <StatCard label="Closed trades" value={d.counts.trades} />
        <StatCard label="Positions" value={d.positions.length} />
        <StatCard label="Analysts" value={d.agents.length} />
        <StatCard label="Alerts" value={d.counts.alerts} />
        <StatCard label="Watchlist" value={d.watchlist.length} />
      </div>

      {/* Learning + conversations — the layer that used to be invisible */}
      <SectionHeader>Learning &amp; conversations</SectionHeader>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Lessons" value={`${d.academy.lessonsDone}/${d.academy.totalLessons}`} />
        <StatCard label="XP" value={d.academy.xp} tone="accent" />
        <StatCard label="Streak" value={`${d.streak.current}d`} sub={`best ${d.streak.longest}`} />
        <StatCard label="Missions" value={d.counts.missions} />
        <StatCard label="Quiz attempts" value={d.counts.quizzes} />
        <StatCard label="Drills · replays" value={`${d.counts.drills} · ${d.counts.replays}`} />
        <StatCard label="Flashcards" value={d.counts.cards} />
        <StatCard label="Messages" value={d.counts.tarsMsgs + d.counts.deskMsgs} sub={d.counts.memory ? "Tars has memory" : "desk + Tars"} />
      </div>

      <SectionHeader>Positions</SectionHeader>
      <DataTable empty="No open positions."
        cols={[{ label: "Symbol" }, { label: "Qty", align: "right" }, { label: "Avg entry", align: "right" }]}
        rows={d.positions.map((p) => [p.symbol, p.qty, usd(p.avgEntryPrice)])} />

      <SectionHeader>Watchlist</SectionHeader>
      <DataTable empty="Watchlist is empty."
        cols={[{ label: "Rank" }, { label: "Symbol" }]}
        rows={d.watchlist.map((w) => [w.rank + 1, w.symbol])} />

      <SectionHeader>Recent orders</SectionHeader>
      <DataTable empty="No orders."
        cols={[{ label: "When" }, { label: "Side" }, { label: "Type" }, { label: "Symbol" }, { label: "Qty", align: "right" }, { label: "Status" }]}
        rows={d.orders.map((o) => [
          when(o.createdAt),
          <span key="s" className={`font-mono text-[10px] uppercase ${o.side === "buy" ? "text-gain" : "text-loss"}`}>{o.side}</span>,
          o.type, o.symbol, o.qty,
          <span key="st" className={`font-mono text-[10px] uppercase ${o.status === "filled" ? "text-gain" : o.status === "rejected" ? "text-loss" : "text-ink-4"}`}>{o.status}</span>,
        ])} />

      <SectionHeader>Analysts</SectionHeader>
      <DataTable empty="No analysts."
        cols={[{ label: "Name" }, { label: "Status" }, { label: "Allocation", align: "right" }]}
        rows={d.agents.map((a) => [a.name, a.status, usd(a.allocation)])} />

      <SectionHeader>Recent closes</SectionHeader>
      <DataTable empty="No closed trades."
        cols={[{ label: "When" }, { label: "Symbol" }, { label: "P&L", align: "right" }]}
        rows={d.journal.map((j) => [
          when(j.createdAt), j.symbol,
          <span key="p" className={j.pnl == null ? "text-ink-4" : j.pnl >= 0 ? "text-gain" : "text-loss"}>{j.pnl == null ? "—" : usd(j.pnl)}</span>,
        ])} />
    </>
  );
}
