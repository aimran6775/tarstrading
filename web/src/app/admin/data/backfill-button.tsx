"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** One-click healing pass — runs the same librarian the cron uses. */
export default function BackfillButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/admin/backfill", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setState("done");
        setNote(`synced ${data.report.synced}, fresh ${data.report.fresh}${data.report.stoppedForTokens ? " · token-limited" : ""}`);
        router.refresh();
      } else { setState("error"); setNote(data.error ?? "failed"); }
    } catch { setState("error"); setNote("network error"); }
  }

  return (
    <div className="flex items-center gap-3">
      {note && <span className="font-mono text-[11px] text-ink-4">{note}</span>}
      <button onClick={run} disabled={state === "running"}
        className="pressable rounded-full border border-hairline px-4 py-2 font-mono text-xs text-ink-2 hover:text-ink-1 disabled:opacity-50">
        {state === "running" ? "Backfilling…" : "Run backfill pass"}
      </button>
    </div>
  );
}
