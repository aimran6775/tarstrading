import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import Placement from "./placement";

export const metadata = { title: "Placement" };

export default async function PlacementPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <Placement />
    </div>
  );
}
