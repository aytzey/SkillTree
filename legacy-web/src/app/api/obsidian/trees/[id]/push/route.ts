import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { toSkillTreeData } from "@/lib/tree-data";
import {
  ObsidianVaultNotConfiguredError,
  writeTreeToObsidianVault,
} from "@/lib/obsidian-vault-sync";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({
    where: { id },
    include: { nodes: true, edges: true },
  });

  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await writeTreeToObsidianVault(
      toSkillTreeData({
        ...tree,
        shareMode: tree.shareMode,
        editTokenHash: tree.editTokenHash,
        canvasState: tree.canvasState as Record<string, unknown> | null,
        nodes: tree.nodes.map((node) => ({
          ...node,
          style: node.style as Record<string, unknown> | null,
        })),
        edges: tree.edges.map((edge) => ({
          ...edge,
          style: edge.style as Record<string, unknown> | null,
        })),
      })
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ObsidianVaultNotConfiguredError) {
      return NextResponse.json(
        { error: "Set OBSIDIAN_VAULT_PATH in .env.local before syncing to Obsidian." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Obsidian sync failed" },
      { status: 500 }
    );
  }
}
