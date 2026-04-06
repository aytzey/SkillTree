import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      subTasks: toPrismaJson(body.subTasks ?? []),
      resources: toPrismaJson(body.resources ?? []),
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(node, { status: 201 });
}
