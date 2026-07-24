"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
  Per-user admin actions. Destructive ones confirm first; every call hits the
  audited /api/admin/user/[id] route and refreshes the view.
*/
export default function UserActions({ id, role, suspended, isSelf }: {
  id: string; role: "user" | "admin"; suspended: boolean; isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function act(action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(action); setNote("");
    try {
      const res = await fetch(`/api/admin/user/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const d = await res.json();
      setNote(d.ok ? "Done." : (d.error || "Failed."));
      if (d.ok) router.refresh();
    } catch { setNote("Network error."); }
    finally { setBusy(null); }
  }

  const Btn = ({ a, label, danger, confirm }: { a: string; label: string; danger?: boolean; confirm?: string }) => (
    <button onClick={() => act(a, confirm)} disabled={busy != null}
      className={`pressable rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${
        danger ? "border-loss/50 text-loss hover:bg-loss/10" : "border-hairline text-ink-2 hover:text-ink-1"
      }`}>
      {busy === a ? "…" : label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suspended
        ? <Btn a="restore" label="Restore access" />
        : <Btn a="suspend" label="Suspend" danger confirm={isSelf ? undefined : "Suspend this user? They'll be signed out and blocked from logging in."} />}
      {role === "admin"
        ? <Btn a="demote" label="Revoke admin" danger={isSelf} confirm={isSelf ? "Remove your OWN admin? You may lose access." : undefined} />
        : <Btn a="promote" label="Make admin" confirm="Grant this user full admin access?" />}
      <Btn a="logout" label="Force sign-out" />
      <Btn a="reset" label="Reset sandbox" danger confirm="Wipe this user's positions, orders, analysts and journal, and restore $100k? Academy progress is kept." />
      {note && <span className="ml-auto font-mono text-[11px] text-ink-3">{note}</span>}
    </div>
  );
}
