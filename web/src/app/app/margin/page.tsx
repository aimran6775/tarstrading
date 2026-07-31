import AppNav from "@/components/app-nav";
import MarginDesk from "./margin-desk";

export const metadata = { title: "Margin Desk" };

export default function MarginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav active="floor" />
      <MarginDesk />
    </div>
  );
}
