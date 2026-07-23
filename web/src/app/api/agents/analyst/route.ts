import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { analystHistory, analystTurn } from "@/server/analyst";

/*
  The analyst desk conversation. GET → the whole thread (full memory);
  POST { text } → one turn: the analyst thinks, may execute a desk action
  (create/backtest/deploy/pause/kill/status), and replies with real numbers.
*/

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, messages: await analystHistory(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { text?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  const text = String(body.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ ok: false, error: "Say something." }, { status: 400 });

  const { reply, acted } = await analystTurn(user.id, text);
  return NextResponse.json({ ok: true, reply, acted });
}
