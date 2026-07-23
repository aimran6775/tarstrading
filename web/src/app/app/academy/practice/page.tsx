import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import Practice from "./practice";

export const metadata = { title: "Practice" };

export default async function PracticePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <Practice />
    </div>
  );
}
