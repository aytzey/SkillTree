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
  const edge = await prisma.skillEdge.create({
    data: {
      treeId: id,
      sourceNodeId: body.sourceNodeId,
      targetNodeId: body.targetNodeId,
      type: body.type ?? "prerequisite",
    },
  });

  return NextResponse.json(edge, { status: 201 });
}
