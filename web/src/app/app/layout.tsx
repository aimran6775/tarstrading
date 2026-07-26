import { ToastProvider, AgentActivityToasts } from "@/components/toast";
import { MarketFooter } from "@/components/market-footer";
import { Icon } from "@/components/icons";
import Atmosphere from "@/components/atmosphere";
import { getPlatformConfig } from "@/server/platform";

/*
  The authenticated shell layout: provides global toasts to every /app surface,
  mounts the background agent-activity watcher, shows the admin broadcast
  banner (when one is set) above everything, and pins the market ticker
  footer — tape, world clock, SIMULATED mark — to the bottom of every screen.
*/
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { announcement } = await getPlatformConfig();
  return (
    <ToastProvider>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }`}</style>
      <Atmosphere />
      <AgentActivityToasts />
      {announcement && (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-agent/30 bg-agent/12 px-4 py-2 text-center text-xs font-medium text-agent">
          <Icon.Spark className="h-3.5 w-3.5 shrink-0" /> {announcement}
        </div>
      )}
      {/* Clearance: ticker (2.25rem) everywhere; + mobile tab bar (3.5rem) below md,
          which is where the header hands navigation over to the bottom bar.
          relative/z-10 keeps content above the fixed atmosphere layers. */}
      <div className="relative z-10 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-9">{children}</div>
      <MarketFooter />
    </ToastProvider>
  );
}
