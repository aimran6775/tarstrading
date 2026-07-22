import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import Standings from "./standings";

export const metadata = { title: "Standings" };

export default async function StandingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="standings" />
      <Standings />
    </div>
  );
}
