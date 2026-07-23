import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { assistantHistory, assistantTurn } from "@/server/assistant";

/*
  The assistant conversation. GET → the whole thread (full memory);
  POST { text } → one turn: the assistant thinks, may act on the floor
  (hire / backtest / deploy / pause / retire / status), and replies.
*/

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, messages: await assistantHistory(user.id) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { text?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  const text = String(body.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ ok: false, error: "Say something." }, { status: 400 });

  const { reply, acted } = await assistantTurn(user.id, text);
  return NextResponse.json({ ok: true, reply, acted });
}
