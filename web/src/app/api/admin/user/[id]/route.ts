import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth";
import { setSuspended, setRole, forceLogout, resetSandbox, editUser, setNote, deleteUser } from "@/server/admin-ops";

/*
  Per-user admin actions. Admin-only, audited (inside each op). Self-protection:
  an admin can't suspend, demote, or delete their own account (no lockout, no
  accidental self-erasure).
*/
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (id === admin.id && (action === "suspend" || action === "demote" || action === "delete")) {
    return NextResponse.json({ ok: false, error: "You can't do that to your own account." }, { status: 400 });
  }

  try {
    switch (action) {
      case "suspend": await setSuspended(admin.id, id, true); break;
      case "restore": await setSuspended(admin.id, id, false); break;
      case "promote": await setRole(admin.id, id, "admin"); break;
      case "demote": await setRole(admin.id, id, "user"); break;
      case "logout": await forceLogout(admin.id, id); break;
      case "reset": await resetSandbox(admin.id, id); break;
      case "edit": await editUser(admin.id, id, { name: body?.name, email: body?.email }); break;
      case "note": await setNote(admin.id, id, String(body?.note ?? "")); break;
      case "delete": await deleteUser(admin.id, id); break;
      default: return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "email_taken") return NextResponse.json({ ok: false, error: "That email is already in use." }, { status: 409 });
    if (msg === "bad_email") return NextResponse.json({ ok: false, error: "That email doesn't look valid." }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Action failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
