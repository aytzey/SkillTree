import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const node = await prisma.skillNode.create({
    data: {
      treeId: id,
      title: body.title || "New Skill",
      description: body.description || null,
      difficulty: body.difficulty ?? 1,
      estimatedHours: body.estimatedHours ?? null,
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      subTasks: body.subTasks ?? [],
      resources: body.resources ?? [],
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(node, { status: 201 });
}
