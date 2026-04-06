import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseTreeImport, type ParsedTreeImport } from "@/lib/tree-portability";
import { toPrismaJson } from "@/lib/prisma-json";

function buildSlug(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${nanoid(6)}`;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { payload?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.payload !== "string") {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  let parsed: ParsedTreeImport;
  try {
    parsed = parseTreeImport(body.payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid import payload" },
      { status: 400 }
    );
  }

  const shareMode = parsed.format === "backup"
    ? parsed.tree.shareMode === "public_edit"
      ? "public_readonly"
      : parsed.tree.shareMode
    : "private";
  const isPublic = parsed.format === "backup" ? parsed.tree.isPublic : false;

  const tree = await prisma.skillTree.create({
    data: {
      userId: user.id,
      title: parsed.tree.title,
      description: parsed.tree.description,
      slug: buildSlug(parsed.tree.title),
      isPublic,
      shareMode,
      theme: parsed.tree.theme,
      canvasState: toPrismaJson(parsed.tree.canvasState),
    },
  });

  const nodeIdMap = new Map<string, string>();

  for (const node of parsed.nodes) {
    const created = await prisma.skillNode.create({
      data: {
        treeId: tree.id,
        title: node.title,
        description: node.description,
        difficulty: node.difficulty,
        estimatedHours: node.estimatedHours,
        progress: node.progress,
        status: node.status,
        positionX: node.positionX,
        positionY: node.positionY,
        style: toPrismaJson(node.style),
        subTasks: toPrismaJson(node.subTasks),
        resources: toPrismaJson(node.resources),
        notes: node.notes,
        subTreeId: node.subTreeId,
      },
    });

    nodeIdMap.set(node.id, created.id);
  }

  for (const node of parsed.nodes) {
    if (!node.parentId) continue;

    await prisma.skillNode.update({
      where: { id: nodeIdMap.get(node.id) },
      data: { parentId: nodeIdMap.get(node.parentId) ?? null },
    });
  }

  for (const edge of parsed.edges) {
    const sourceNodeId = nodeIdMap.get(edge.sourceNodeId);
    const targetNodeId = nodeIdMap.get(edge.targetNodeId);
    if (!sourceNodeId || !targetNodeId) continue;

    await prisma.skillEdge.create({
      data: {
        treeId: tree.id,
        sourceNodeId,
        targetNodeId,
        type: edge.type,
        style: toPrismaJson(edge.style),
      },
    });
  }

  return NextResponse.json({ treeId: tree.id }, { status: 201 });
}
