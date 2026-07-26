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
  /* Equity/crypto ticker, an FX: pair, or an OCC option contract. FX was listed
     on the board while this regex still rejected the colon, so all 16 pairs
     404'd — visible in Markets, unreachable when clicked. */
  const ROUTABLE = /^([A-Z.]{1,8}(\/[A-Z]{3,4})?|FX:[A-Z]{6}|[A-Z]{1,6}\d{6}[CP]\d{8})$/;
  if (!ROUTABLE.test(symbol)) notFound();

  const sp = await searchParams;
  return <MarketView symbol={symbol} initialTray={sp.tray} initialSide={sp.side} />;
}
