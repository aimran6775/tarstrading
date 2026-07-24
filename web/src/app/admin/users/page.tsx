import { db, schema } from "@/server/db";
import { desc, eq, sql as dsql } from "drizzle-orm";
import UsersRoster from "./roster";

/*
  Users — the roster and the entry to per-user management. Search, then click a
  trader to open their 360° profile and act (suspend, reset sandbox, promote…).
*/
export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  const rows = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    name: schema.users.name,
    role: schema.users.role,
    suspended: schema.users.suspended,
    createdAt: schema.users.createdAt,
    equity: schema.accounts.equity,
    orders: dsql<number>`(select count(*)::int from orders o where o.user_id = ${schema.users.id})`,
  })
    .from(schema.users)
    .leftJoin(schema.accounts, eq(schema.accounts.userId, schema.users.id))
    .orderBy(desc(schema.users.createdAt))
    .limit(500);

  return (
    <>
      <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-ink-4">Users · {rows.length}</h1>
      <UsersRoster rows={rows} />
    </>
  );
}
