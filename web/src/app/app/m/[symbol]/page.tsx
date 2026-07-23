import { currentUser } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import MarketView from "./market-view";

/*
  A market's home: chart-first, ticket in the right rail, portfolio tray below.
*/

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol).toUpperCase() };
}

export default async function MarketPage({ params, searchParams }: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tray?: string; side?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!/^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(symbol)) notFound();

  const sp = await searchParams;
  return <MarketView symbol={symbol} initialTray={sp.tray} initialSide={sp.side} />;
}
