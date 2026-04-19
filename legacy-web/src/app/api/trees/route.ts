import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trees = await prisma.skillTree.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { nodes: true } },
      nodes: { select: { progress: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = trees.map((tree) => {
    const totalProgress = tree.nodes.length > 0
      ? Math.round(tree.nodes.reduce((sum, n) => sum + n.progress, 0) / tree.nodes.length)
      : 0;
    return {
      id: tree.id, title: tree.title, description: tree.description,
      slug: tree.slug, isPublic: tree.isPublic, nodeCount: tree._count.nodes,
      progress: totalProgress, updatedAt: tree.updatedAt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description } = await req.json();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${nanoid(6)}`;

  const tree = await prisma.skillTree.create({
    data: { userId: user.id, title, description, slug },
  });

  return NextResponse.json(tree, { status: 201 });
}
