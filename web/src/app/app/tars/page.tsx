import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import TarsChat from "./chat";

export default async function TarsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="tars" />
      <TarsChat userName={user.name} />
    </div>
  );
}
