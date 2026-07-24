import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth";
import { setSuspended, setRole, forceLogout, resetSandbox } from "@/server/admin-ops";

/*
  Per-user admin actions. Admin-only, audited (inside each op). Self-protection:
  an admin can't suspend or demote their own account (no accidental lockout).
*/
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { id } = await ctx.params;
  const action = String((await request.json().catch(() => ({})))?.action ?? "");

  if (id === admin.id && (action === "suspend" || action === "demote")) {
    return NextResponse.json({ ok: false, error: "You can't lock yourself out." }, { status: 400 });
  }

  switch (action) {
    case "suspend": await setSuspended(admin.id, id, true); break;
    case "restore": await setSuspended(admin.id, id, false); break;
    case "promote": await setRole(admin.id, id, "admin"); break;
    case "demote": await setRole(admin.id, id, "user"); break;
    case "logout": await forceLogout(admin.id, id); break;
    case "reset": await resetSandbox(admin.id, id); break;
    default: return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
