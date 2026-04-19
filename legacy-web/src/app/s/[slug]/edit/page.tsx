import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeNodeStatuses } from "@/lib/status-engine";
import { SkillTreeEditor } from "@/components/editor/skill-tree-editor";
import { toSkillTreeData } from "@/lib/tree-data";
import { resolveTreeAccess } from "@/lib/tree-access";

export default async function SharedEditPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { token?: string };
}) {
  const { slug } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { slug },
    include: { nodes: true, edges: true },
  });

  if (!tree) notFound();

  const access = resolveTreeAccess(tree, {
    userId: null,
    editToken: searchParams.token ?? null,
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

  return (
    <SkillTreeEditor
      tree={{
        ...treeData,
        nodes: treeData.nodes.map((node) => ({
          ...node,
          status: statuses.get(node.id) || node.status,
        })),
      }}
      canEdit={access.canEdit}
      canManageShare={false}
      sharedEditToken={access.canEdit ? searchParams.token ?? null : null}
    />
  );
}
