import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";

export async function PUT(req: NextRequest, { params }: { params: { id: string; edgeId: string } }) {
  const { id, edgeId } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const edge = await prisma.skillEdge.update({
    where: { id: edgeId },
    data: { type: body.type },
  });

  return NextResponse.json(edge);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; edgeId: string } }) {
  const { id, edgeId } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.skillEdge.delete({ where: { id: edgeId } });
  return NextResponse.json({ ok: true });
}
