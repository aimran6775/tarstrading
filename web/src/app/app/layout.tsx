import { ToastProvider, AgentActivityToasts } from "@/components/toast";
import { getPlatformConfig } from "@/server/platform";

/*
  The authenticated shell layout: provides global toasts to every /app surface,
  mounts the background agent-activity watcher, and shows the admin broadcast
  banner (when one is set) above everything.
*/
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { announcement } = await getPlatformConfig();
  return (
    <ToastProvider>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }`}</style>
      <AgentActivityToasts />
      {announcement && (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-agent/30 bg-agent/12 px-4 py-2 text-center text-xs font-medium text-agent">
          <span aria-hidden>📣</span> {announcement}
        </div>
      )}
      {children}
    </ToastProvider>
  );
}
