import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { converse, history, memoryOf, clearConversation, brainStatus } from "@/server/tars";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    messages: history(user.id, 200),
    memory: memoryOf(user.id),
    brain: brainStatus(),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { text } = await request.json();
  const clean = String(text ?? "").trim().slice(0, 2000);
  if (!clean) return NextResponse.json({ ok: false, error: "Say something." }, { status: 400 });
  const reply = await converse(user.id, user.name, clean);
  return NextResponse.json({ ok: true, reply });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  clearConversation(user.id);
  return NextResponse.json({ ok: true });
}
