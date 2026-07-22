import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import Terminal from "./terminal";

/*
  The terminal shell (Act I version): account strip + live watchlist.
  Chart, ticket, positions land in Act III — this page proves the whole
  loop: auth → $100k account → real quotes → simulated badge.
*/
export const metadata = { title: "Terminal" };

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Terminal userName={user.name} />;
}
