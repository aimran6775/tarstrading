import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import AgentLab from "./lab";

export const metadata = { title: "Agent Lab" };

export default async function AgentsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="agents" />
      <AgentLab />
    </div>
  );
}
