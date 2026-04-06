import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { SkillTreeEditor } from "@/components/editor/skill-tree-editor";
import { computeNodeStatuses } from "@/lib/status-engine";
import { toSkillTreeData } from "@/lib/tree-data";

export default async function TreeEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tree = await prisma.skillTree.findUnique({
    where: { id },
    include: { nodes: true, edges: true },
  });

  if (!tree || tree.userId !== user.id) redirect("/dashboard");

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
  const nodesWithStatus = treeData.nodes.map((n) => ({
    ...n,
    status: statuses.get(n.id) || n.status,
  }));

  return (
    <SkillTreeEditor
      tree={{ ...treeData, nodes: nodesWithStatus }}
      canEdit
      canManageShare
    />
  );
}
