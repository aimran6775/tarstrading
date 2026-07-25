import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/server/auth";
import TarsWordmark from "@/components/tars-wordmark";
import ThemeToggle from "@/components/theme-toggle";
import AdminNav, { SignOutButton } from "./nav";

/*
  The control-center shell — an operations command deck, not an admin panel.

  Desktop gets a persistent left sidebar (identity, sections, operator) with the
  content column scrolling on its own, so the register and the operator's own
  identity never leave the screen while you dig through a table. Phones collapse
  it to a masthead plus a scrollable section rail.

  Non-operators never see a byte of this: the guard runs server-side, before any
  child renders, and bounces to the console's own front door.
*/
export const metadata = { title: { default: "Admin", template: "%s · Tars Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  // The console has its own front door — unauthenticated operators sign in
  // there, they are never bounced into the product.
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-bg0 md:h-screen md:overflow-hidden">
      {/* ---- Desktop: the persistent register ---- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-bg1 md:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/admin" className="pressable inline-flex" aria-label="Tars control center">
            <TarsWordmark size={20} />
          </Link>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-agent/40 bg-agent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-agent">
            <span aria-hidden className="h-1 w-1 rounded-full bg-agent" />
            Control center
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <AdminNav />
        </div>

        {/* ---- The operator plate ---- */}
        <div className="border-t border-hairline px-3 py-3">
          <p className="px-3 font-mono text-[9px] uppercase tracking-[0.24em] text-ink-4">Operator</p>
          <p className="truncate px-3 pt-0.5 font-mono text-[11px] text-ink-2" title={admin.email}>{admin.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1"><SignOutButton /></div>
            <ThemeToggle compact />
          </div>
        </div>
      </aside>

      {/* ---- The content column: its own scroll, its own max width ---- */}
      <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
        {/* ---- Mobile: masthead + section rail ---- */}
        <header className="glass sticky top-0 z-50 md:hidden">
          <div className="flex items-center gap-3 px-4 py-2">
            <Link href="/admin" className="pressable shrink-0" aria-label="Tars control center">
              <TarsWordmark size={18} text="TARS" />
            </Link>
            <span className="hidden shrink-0 rounded-full border border-agent/40 bg-agent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-agent min-[420px]:inline-block">
              Control center
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <ThemeToggle compact />
              <SignOutButton compact />
            </div>
          </div>
          <div className="overflow-x-auto overscroll-x-contain border-t border-hairline px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AdminNav variant="rail" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
