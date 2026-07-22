import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { cancelOrder } from "@/server/exchange";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const canceled = await cancelOrder(user.id, id);
  return NextResponse.json({ ok: canceled }, { status: canceled ? 200 : 409 });
}
