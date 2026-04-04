import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; edgeId: string } }) {
  const { id, edgeId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.skillEdge.delete({ where: { id: edgeId } });
  return NextResponse.json({ ok: true });
}
