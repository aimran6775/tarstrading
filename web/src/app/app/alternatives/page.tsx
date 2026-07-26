import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import AlternativesDesk from "./desk";

export const metadata = {
  title: "Alternatives",
  description: "Commit capital to private funds and watch the J-curve play out.",
};

export default async function AlternativesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="alternatives" />
      <AlternativesDesk />
    </div>
  );
}
