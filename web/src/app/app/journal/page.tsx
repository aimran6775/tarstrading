import AppNav from "@/components/app-nav";
import JournalView from "./journal-view";

export const metadata = { title: "Journal" };

export default function JournalPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav active="floor" />
      <JournalView />
    </div>
  );
}
