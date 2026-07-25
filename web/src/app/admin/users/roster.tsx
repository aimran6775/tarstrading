"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string; email: string; name: string; role: "user" | "admin";
  suspended: number; createdAt: number; equity: number | null; orders: number;
};

const STARTING = 100_000;

export default function UsersRoster({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)) : rows;
  }, [q, rows]);

  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="w-full max-w-sm rounded-lg border border-hairline bg-bg2 px-3 py-2 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-agent/50" />
        <span className="shrink-0 font-mono text-[11px] text-ink-4">{filtered.length} shown</span>
      </div>

      <section className="panel mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">
              <th className="px-4 py-2.5">Trader</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Equity</th>
              <th className="px-4 py-2.5">Return</th>
              <th className="px-4 py-2.5">Orders</th>
              <th className="px-4 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-4">No matches.</td></tr>}
            {filtered.map((u) => {
              const ret = u.equity != null ? (u.equity - STARTING) / STARTING : null;
              return (
                <tr key={u.id} onClick={() => router.push(`/admin/users/${u.id}`)}
                  className="cursor-pointer border-b border-hairline last:border-0 hover:bg-bg3/60">
                  <td className="px-4 py-2">
                    <p className="flex items-center gap-2 font-medium text-ink-1">
                      {u.name}
                      {u.suspended ? <span className="rounded bg-loss/15 px-1.5 text-[9px] uppercase text-loss">susp</span> : null}
                    </p>
                    <p className="text-[11px] text-ink-4">{u.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${u.role === "admin" ? "text-agent" : "text-ink-4"}`}>{u.role}</span>
                  </td>
                  <td className="tnum px-4 py-2 text-ink-1">{u.equity != null ? `$${Math.round(u.equity).toLocaleString()}` : "—"}</td>
                  <td className={`tnum px-4 py-2 ${ret == null ? "text-ink-4" : ret > 0 ? "text-gain" : ret < 0 ? "text-loss" : "text-ink-3"}`}>
                    {ret != null ? `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="tnum px-4 py-2 text-ink-2">{u.orders}</td>
                  <td className="tnum px-4 py-2 text-ink-3">{new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
