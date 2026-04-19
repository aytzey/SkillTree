import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { toPrismaJson } from "@/lib/prisma-json";
import {
  ObsidianVaultNotConfiguredError,
  readTreeFromObsidianVault,
} from "@/lib/obsidian-vault-sync";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existingTree = await prisma.skillTree.findUnique({ where: { id } });
  if (!existingTree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existingTree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const mirroredTree = await readTreeFromObsidianVault(id, user.id);
    const nodeIds = new Set(mirroredTree.nodes.map((node) => node.id));

    await prisma.$transaction(async (tx) => {
      await tx.skillEdge.deleteMany({ where: { treeId: id } });
      await tx.skillNode.updateMany({
        where: { treeId: id },
        data: { parentId: null },
      });
      await tx.skillNode.deleteMany({ where: { treeId: id } });

      await tx.skillTree.update({
        where: { id },
        data: {
          title: mirroredTree.title,
          description: mirroredTree.description,
          theme: mirroredTree.theme,
          canvasState: toPrismaJson(mirroredTree.canvasState),
        },
      });

      for (const node of mirroredTree.nodes) {
        await tx.skillNode.create({
          data: {
            id: node.id,
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
      }

      for (const node of mirroredTree.nodes) {
        if (!node.parentId || !nodeIds.has(node.parentId)) continue;
        await tx.skillNode.update({
          where: { id: node.id },
          data: { parentId: node.parentId },
        });
      }

      for (const edge of mirroredTree.edges) {
        if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue;
        await tx.skillEdge.create({
          data: {
            id: edge.id,
            treeId: id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            type: edge.type,
            style: toPrismaJson(edge.style),
          },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      title: mirroredTree.title,
      nodeCount: mirroredTree.nodes.length,
      edgeCount: mirroredTree.edges.length,
    });
  } catch (error) {
    if (error instanceof ObsidianVaultNotConfiguredError) {
      return NextResponse.json(
        { error: "Set OBSIDIAN_VAULT_PATH in .env.local before pulling from Obsidian." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Obsidian pull failed" },
      { status: 500 }
    );
  }
}
