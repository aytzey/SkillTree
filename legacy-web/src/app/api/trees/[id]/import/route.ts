import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { parseTreeImport, type ParsedTreeImport } from "@/lib/tree-portability";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const { tree, access } = await getTreeRouteAccessById(req, id);

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const nodeIdMap = new Map<string, string>();

  await prisma.skillEdge.deleteMany({ where: { treeId: id } });
  await prisma.skillNode.deleteMany({ where: { treeId: id } });

  const treeUpdate: {
    title: string;
    description: string | null;
    theme: string;
    canvasState: ReturnType<typeof toPrismaJson>;
    isPublic?: boolean;
    shareMode?: "private" | "public_readonly" | "public_edit";
  } = {
    title: parsed.tree.title,
    description: parsed.tree.description,
    theme: parsed.tree.theme,
    canvasState: toPrismaJson(parsed.tree.canvasState),
  };

  if (access.isOwner && parsed.format === "backup") {
    treeUpdate.isPublic = parsed.tree.isPublic;
    treeUpdate.shareMode = parsed.tree.shareMode === "public_edit" ? "public_readonly" : parsed.tree.shareMode;
  }

  await prisma.skillTree.update({ where: { id }, data: treeUpdate });

  for (const node of parsed.nodes) {
    const created = await prisma.skillNode.create({
      data: {
        treeId: id,
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

    const createdId = nodeIdMap.get(node.id);
    if (!createdId) continue;

    await prisma.skillNode.update({
      where: { id: createdId },
      data: { parentId: nodeIdMap.get(node.parentId) ?? null },
    });
  }

  for (const edge of parsed.edges) {
    const sourceNodeId = nodeIdMap.get(edge.sourceNodeId);
    const targetNodeId = nodeIdMap.get(edge.targetNodeId);
    if (!sourceNodeId || !targetNodeId) continue;

    await prisma.skillEdge.create({
      data: {
        treeId: id,
        sourceNodeId,
        targetNodeId,
        type: edge.type,
        style: toPrismaJson(edge.style),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
