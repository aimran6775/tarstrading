import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import Browse from "./browse";

/*
  /app is now Browse — the markets-first home. Old deep links keep working:
  ?symbol=X → the symbol's market page; ?perf=1 → the performance tray.
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

  return <Browse userName={user.name} welcome={params.welcome === "1"} />;
}
