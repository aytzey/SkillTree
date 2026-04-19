import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeNodeStatuses } from "@/lib/status-engine";
import { PublicTreeView } from "./public-view";
import { toSkillTreeData } from "@/lib/tree-data";
import { resolveTreeAccess } from "@/lib/tree-access";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });

  if (!tree) return { title: "Not Found" };
  return {
    title: `${tree.title} — SkillTree`,
    description: tree.description || `Skill tree: ${tree.title}`,
  };
}

export default async function PublicViewPage({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { slug },
    include: { nodes: true, edges: true, user: { select: { name: true } } },
  });

  if (!tree) notFound();

  const access = resolveTreeAccess(tree, {
    userId: null,
    editToken: null,
  });

  if (!access.canView) notFound();

  const treeData = toSkillTreeData({
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
  });

  const statuses = computeNodeStatuses(treeData.nodes, treeData.edges);
  const nodesWithStatus = treeData.nodes.map((node) => ({
    ...node,
    status: statuses.get(node.id) || node.status,
  }));

  return (
    <PublicTreeView
      title={tree.title}
      authorName={tree.user.name}
      nodes={nodesWithStatus}
      edges={treeData.edges}
      shareMode={access.shareMode}
      isReadOnly={!access.canEdit}
    />
  );
}
