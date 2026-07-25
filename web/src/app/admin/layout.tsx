import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/auth";
import TarsWordmark from "@/components/tars-wordmark";
import AdminNav from "./nav";

/*
  The admin shell — a control center: a guarded top bar with the active-aware
  nav, dense mono labels, and semantic color reserved for state. Non-admins
  never see a byte of it (server-guarded, redirected to /app).
*/
export const metadata = { title: { default: "Admin", template: "%s · Tars Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/app" className="shrink-0"><TarsWordmark size={20} /></Link>
          <span className="hidden shrink-0 rounded-full border border-agent/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-agent sm:block">
            Control center
          </span>
          <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AdminNav />
          </div>
        </div>
        <span className="hidden shrink-0 font-mono text-[11px] text-ink-4 md:block">{admin.email}</span>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
