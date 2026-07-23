import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import AppNav from "@/components/app-nav";
import Replay from "./replay";

export const metadata = { title: "Replay" };

export default async function ReplayPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = await db.select({
    scenarioId: schema.replayResults.scenarioId,
    playerReturn: schema.replayResults.playerReturn,
    buyHoldReturn: schema.replayResults.buyHoldReturn,
  }).from(schema.replayResults).where(eq(schema.replayResults.userId, user.id));

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <Replay initialResults={rows} />
    </div>
  );
}
