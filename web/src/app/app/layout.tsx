import { ToastProvider, AgentActivityToasts } from "@/components/toast";

/*
  The authenticated shell layout: provides global toasts to every /app surface
  and mounts the background agent-activity watcher so fills reach you wherever
  you are. The keyframe for toast entrance lives here too.
*/
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }`}</style>
      <AgentActivityToasts />
      {children}
    </ToastProvider>
  );
}
