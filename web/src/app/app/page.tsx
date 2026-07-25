import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import Browse from "./browse";
import { getHouseBoard } from "@/server/board";

/*
  /app is now Browse — the markets-first home. Old deep links keep working:
  ?symbol=X → the symbol's market page; ?perf=1 → the performance tray.

  The market universe comes from the control center's curated board (one query,
  briefly cached, with a hardcoded fallback) — not from a list baked into the UI.
*/
export const metadata = { title: "Markets" };

export default async function AppPage({ searchParams }: {
  searchParams: Promise<{ symbol?: string; perf?: string; welcome?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  if (params.symbol) redirect(`/app/m/${encodeURIComponent(params.symbol.toUpperCase())}`);
  if (params.perf === "1") redirect("/app/m/SPY?tray=perf");

  const board = await getHouseBoard();

  return <Browse userName={user.name} welcome={params.welcome === "1"} board={board} />;
}
