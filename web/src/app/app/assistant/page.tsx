import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import AnalystFloor from "./floor";

export const metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="assistant" />
      <AnalystFloor />
    </div>
  );
}
