import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const { id, nodeId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
      style: body.style,
      subTasks: body.subTasks,
      resources: body.resources,
      notes: body.notes,
      subTreeId: body.subTreeId,
    },
  });

  return NextResponse.json(node);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const { id, nodeId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.skillNode.delete({ where: { id: nodeId } });
  return NextResponse.json({ ok: true });
}
