import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { id },
    include: { nodes: true, edges: true },
  });

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getSessionUser();
  if (!tree.isPublic && tree.userId !== user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(tree);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.skillTree.update({
    where: { id },
    data: {
      title: body.title ?? tree.title,
      description: body.description ?? tree.description,
      canvasState: body.canvasState ?? tree.canvasState,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.skillTree.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
