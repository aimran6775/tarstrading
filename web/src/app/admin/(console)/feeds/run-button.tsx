"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Run the whole mesh right now — the same pass the scheduler drives every
    minute (sweep + live slots) and every five (FX, indices, futures). */
export default function RunFeedsButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/admin/feeds", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setState("done");
        setNote(`swept ${data.fast?.sweep?.swept ?? 0} · slots ${data.fast?.liveSlots ?? 0}`);
        router.refresh();
      } else { setState("error"); setNote(data.error ?? "failed"); }
    } catch { setState("error"); setNote("network error"); }
  }

  return (
    <div className="flex items-center gap-3">
      {note && <span className="font-mono text-[11px] text-ink-4">{note}</span>}
      <button onClick={run} disabled={state === "running"}
        className="pressable rounded-full border border-hairline px-4 py-2 font-mono text-xs text-ink-2 hover:text-ink-1 disabled:opacity-50">
        {state === "running" ? "Running…" : "Run feeds pass"}
      </button>
    </div>
  );
}
