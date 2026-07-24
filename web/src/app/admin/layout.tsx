import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/auth";
import TarsWordmark from "@/components/tars-wordmark";

/*
  The admin shell — utilitarian by design: dense mono labels, no marketing
  polish. Server-guarded: non-admins never see a byte of it.
*/
export const metadata = { title: { default: "Admin", template: "%s · Tars Admin" } };

const NAV: [string, string][] = [
  ["Overview", "/admin"],
  ["Academy", "/admin/academy"],
  ["Data ops", "/admin/data"],
  ["Users", "/admin/users"],
  ["Controls", "/admin/system"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/app"><TarsWordmark size={20} /></Link>
          <span className="rounded-full border border-agent/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-agent">
            Admin
          </span>
          <nav className="flex gap-1">
            {NAV.map(([label, href]) => (
              <Link key={href} href={href}
                className="pressable rounded-full px-3 py-1.5 font-mono text-xs text-ink-3 hover:bg-bg3 hover:text-ink-1">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <span className="hidden font-mono text-[11px] text-ink-4 md:block">{admin.email}</span>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
