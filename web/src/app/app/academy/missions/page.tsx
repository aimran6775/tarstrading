import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import AppNav from "@/components/app-nav";
import { gradeAllMissions } from "@/server/missions-grader";
import { missionById } from "@/lib/academy/missions";
import Missions from "./missions";

export const metadata = { title: "Missions" };
export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const graded = await gradeAllMissions(user.id, false);
  const earnedXP = graded.filter((g) => g.complete).reduce((s, g) => s + (missionById(g.missionId)?.xp ?? 0), 0);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="academy" />
      <Missions initialGraded={graded} earnedXP={earnedXP} />
    </div>
  );
}
