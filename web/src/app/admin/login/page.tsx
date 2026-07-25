import { redirect } from "next/navigation";
import { consoleUser } from "@/server/auth";
import ConsoleLoginForm from "./form";

export const metadata = { title: "Sign in · Tars Control Center" };
export const dynamic = "force-dynamic";

/** The console's front door. Already signed in? Go straight to the deck. */
export default async function ConsoleLoginPage() {
  if (await consoleUser()) redirect("/admin");
  return <ConsoleLoginForm />;
}
