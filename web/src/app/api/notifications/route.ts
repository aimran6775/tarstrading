import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { recentNotifications, markAllRead, sinceYouLeft } from "@/server/notify";

/*
  The bell. One GET carries recent notices, the unread count, and — on the
  first load after a real absence — the "since you left" digest, so the app
  never pays for a second request to tell you what you missed.
*/
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  // The digest is computed only on an explicit ask (page load), not on every
  // poll — sinceYouLeft() stamps lastSeenAt, and stamping it every 30 seconds
  // would mean nobody is ever "away".
  const wantDigest = url.searchParams.get("digest") === "1";

  const [{ rows, unread }, digest] = await Promise.all([
    recentNotifications(user.id),
    wantDigest ? sinceYouLeft(user.id) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ok: true, notifications: rows, unread, digest });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
