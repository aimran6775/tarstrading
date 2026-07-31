import AppNav from "@/components/app-nav";
import RiskView from "./risk-view";

export const metadata = { title: "Risk" };

export default function RiskPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav active="floor" />
      <RiskView />
    </div>
  );
}
