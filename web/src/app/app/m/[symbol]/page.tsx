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
  /* Equity/crypto ticker, an FX: pair, an IDX: index level, a FUT: contract,
     or an OCC option contract. FX taught the lesson here — listed on the
     board while this regex rejected the colon, so every pair 404'd. When the
     feeds mesh added indices and futures, the same trap was waiting; the
     regex now names every prefix the board can serve. (Both new classes are
     quote-only: the page renders, the ticket explains instead of trading.) */
  const ROUTABLE = /^([A-Z.]{1,8}(\/[A-Z]{3,4})?|FX:[A-Z]{6}|IDX:[A-Z]{1,6}|FUT:[A-Z0-9]{2,6}|[A-Z]{1,6}\d{6}[CP]\d{8})$/;
  if (!ROUTABLE.test(symbol)) notFound();

  const sp = await searchParams;
  return <MarketView symbol={symbol} initialTray={sp.tray} initialSide={sp.side} />;
}
