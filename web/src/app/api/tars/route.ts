import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { converse, converseStream, history, memoryOf, clearConversation, brainStatus } from "@/server/tars";

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
  let body: { text?: unknown; stream?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const clean = String(body.text ?? "").trim().slice(0, 2000);
  if (!clean) return NextResponse.json({ ok: false, error: "Say something." }, { status: 400 });

  // Non-streaming path (kept for simple clients / tests).
  if (body.stream === false) {
    const reply = await converse(user.id, user.name, clean);
    return NextResponse.json({ ok: true, reply });
  }

  // Streaming path: plain text chunks as the model produces them.
  const encoder = new TextEncoder();
  const gen = converseStream(user.id, user.name, clean);
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) { controller.close(); return; }
        controller.enqueue(encoder.encode(value));
      } catch {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  clearConversation(user.id);
  return NextResponse.json({ ok: true });
}
