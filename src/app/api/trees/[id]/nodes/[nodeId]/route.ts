import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { toOptionalPrismaJson } from "@/lib/prisma-json";

export async function PUT(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const { id, nodeId } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const node = await prisma.skillNode.update({
    where: { id: nodeId },
    data: {
      title: body.title,
      description: body.description,
      difficulty: body.difficulty,
      estimatedHours: body.estimatedHours,
      progress: body.progress,
      status: body.status,
      positionX: body.positionX,
      positionY: body.positionY,
      style: toOptionalPrismaJson(body.style),
      subTasks: toOptionalPrismaJson(body.subTasks),
      resources: toOptionalPrismaJson(body.resources),
      notes: body.notes,
      subTreeId: body.subTreeId,
    },
  });

  return NextResponse.json(node);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const { id, nodeId } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.skillNode.delete({ where: { id: nodeId } });
  return NextResponse.json({ ok: true });
}
