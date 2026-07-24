"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
  Per-user admin actions. Destructive ones confirm first; every call hits the
  audited /api/admin/user/[id] route. Delete redirects to the roster (the page
  it acted on no longer exists); everything else refreshes in place.
*/
export default function UserActions({ id, role, suspended, isSelf, name, email, note }: {
  id: string; role: "user" | "admin"; suspended: boolean; isSelf: boolean;
  name: string; email: string; note: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [nm, setNm] = useState(name);
  const [em, setEm] = useState(email);
  const [nt, setNt] = useState(note);

  async function post(action: string, extra?: Record<string, unknown>): Promise<boolean> {
    setBusy(action); setMsg("");
    try {
      const res = await fetch(`/api/admin/user/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      setMsg(d.ok ? "Saved." : (d.error || "Failed."));
      return !!d.ok;
    } catch { setMsg("Network error."); return false; }
    finally { setBusy(null); }
  }

  async function act(action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    if (await post(action)) router.refresh();
  }

  async function saveEdit() {
    if (await post("edit", { name: nm, email: em })) { setEditing(false); router.refresh(); }
  }

  async function saveNote() {
    if (await post("note", { note: nt })) router.refresh();
  }

  async function del() {
    if (!window.confirm(`PERMANENTLY delete ${name}? This erases their account and every position, order, analyst, lesson and chat. This cannot be undone.`)) return;
    if (!window.confirm("Are you absolutely sure? There is no recovery.")) return;
    if (await post("delete")) router.push("/admin/users");
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
    <div className="flex flex-col gap-4">
      {/* Lifecycle actions */}
      <div className="flex flex-wrap items-center gap-2">
        {suspended
          ? <Btn a="restore" label="Restore access" />
          : <Btn a="suspend" label="Suspend" danger confirm={isSelf ? undefined : "Suspend this user? They'll be signed out and blocked from logging in."} />}
        {role === "admin"
          ? <Btn a="demote" label="Revoke admin" danger={isSelf} confirm={isSelf ? "Remove your OWN admin? You may lose access." : undefined} />
          : <Btn a="promote" label="Make admin" confirm="Grant this user full admin access?" />}
        <Btn a="logout" label="Force sign-out" />
        <Btn a="reset" label="Reset sandbox" danger confirm="Wipe this user's positions, orders, analysts and journal, and restore $100k? Academy progress is kept." />
        <button onClick={() => setEditing((v) => !v)} disabled={busy != null}
          className="pressable rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-ink-2 hover:text-ink-1 disabled:opacity-50">
          {editing ? "Cancel edit" : "Edit profile"}
        </button>
        {!isSelf && (
          <button onClick={del} disabled={busy != null}
            className="pressable ml-auto rounded-lg border border-loss/60 px-3 py-2 text-xs font-semibold text-loss hover:bg-loss/10 disabled:opacity-50">
            {busy === "delete" ? "Deleting…" : "Delete user"}
          </button>
        )}
        {msg && <span className="w-full font-mono text-[11px] text-ink-3 sm:w-auto">{msg}</span>}
      </div>

      {/* Inline profile edit */}
      {editing && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-bg2 p-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">Name</span>
            <input value={nm} onChange={(e) => setNm(e.target.value)}
              className="rounded-md border border-hairline bg-bg3 px-2.5 py-1.5 text-sm text-ink-1 outline-none focus:border-agent/50" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">Email</span>
            <input value={em} onChange={(e) => setEm(e.target.value)} type="email"
              className="w-64 rounded-md border border-hairline bg-bg3 px-2.5 py-1.5 text-sm text-ink-1 outline-none focus:border-agent/50" />
          </label>
          <button onClick={saveEdit} disabled={busy != null}
            className="pressable rounded-lg border border-agent/50 bg-agent/10 px-3 py-2 text-xs font-medium text-agent disabled:opacity-50">
            {busy === "edit" ? "Saving…" : "Save profile"}
          </button>
        </div>
      )}

      {/* Admin note */}
      <div className="flex items-end gap-2">
        <label className="flex w-full max-w-2xl flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-4">Admin note</span>
          <textarea value={nt} onChange={(e) => setNt(e.target.value)} rows={2} maxLength={500}
            placeholder="Private note about this account — why suspended, what to watch…"
            className="resize-y rounded-md border border-hairline bg-bg2 px-2.5 py-1.5 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-agent/50" />
        </label>
        <button onClick={saveNote} disabled={busy != null || nt === note}
          className="pressable rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-ink-2 hover:text-ink-1 disabled:opacity-40">
          {busy === "note" ? "…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
