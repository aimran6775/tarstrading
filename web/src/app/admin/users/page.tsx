import { db, schema } from "@/server/db";
import { desc, eq, sql as dsql } from "drizzle-orm";

/*
  Users — the roster: who's on the platform, what their book looks like,
  and how active they are. Read-only by design; the simulator has no
  admin-side money levers, and that's a feature.
*/
export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const STARTING = 100_000;

export default async function AdminUsers() {
  const rows = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    name: schema.users.name,
    role: schema.users.role,
    createdAt: schema.users.createdAt,
    equity: schema.accounts.equity,
    cash: schema.accounts.cash,
    orders: dsql<number>`(select count(*)::int from orders o where o.user_id = ${schema.users.id})`,
  })
    .from(schema.users)
    .leftJoin(schema.accounts, eq(schema.accounts.userId, schema.users.id))
    .orderBy(desc(schema.users.createdAt))
    .limit(200);

  return (
    <>
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Users · {rows.length}</h1>
      <section className="panel mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
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
            {rows.map((u) => {
              const ret = u.equity != null ? (u.equity - STARTING) / STARTING : null;
              return (
                <tr key={u.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium text-ink-1">{u.name}</p>
                    <p className="text-[11px] text-ink-4">{u.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                      u.role === "admin" ? "text-agent" : "text-ink-4"}`}>{u.role}</span>
                  </td>
                  <td className="tnum px-4 py-2 text-ink-1">
                    {u.equity != null ? `$${Math.round(u.equity).toLocaleString()}` : "—"}
                  </td>
                  <td className={`tnum px-4 py-2 ${
                    ret == null ? "text-ink-4" : ret > 0 ? "text-gain" : ret < 0 ? "text-loss" : "text-ink-3"}`}>
                    {ret != null ? `${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="tnum px-4 py-2 text-ink-2">{u.orders}</td>
                  <td className="tnum px-4 py-2 text-ink-3">
                    {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
