import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
