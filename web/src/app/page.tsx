import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import Landing from "@/components/landing";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/app");
  return <Landing />;
}
