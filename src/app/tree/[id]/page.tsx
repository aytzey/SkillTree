import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { SkillTreeEditor } from "@/components/editor/skill-tree-editor";
import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";

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

  const nodesData: SkillNodeData[] = tree.nodes.map((n) => ({
    ...n,
    status: n.status as SkillNodeData["status"],
    subTasks: (n.subTasks as unknown as SkillNodeData["subTasks"]) || [],
    resources: (n.resources as unknown as SkillNodeData["resources"]) || [],
    style: n.style as Record<string, unknown> | null,
  }));

  const edgesData: SkillEdgeData[] = tree.edges.map((e) => ({
    ...e,
    type: e.type as SkillEdgeData["type"],
    style: e.style as Record<string, unknown> | null,
  }));

  const statuses = computeNodeStatuses(nodesData, edgesData);
  const nodesWithStatus = nodesData.map((n) => ({
    ...n,
    status: statuses.get(n.id) || n.status,
  }));

  const treeData = {
    id: tree.id,
    userId: tree.userId,
    title: tree.title,
    description: tree.description,
    slug: tree.slug,
    isPublic: tree.isPublic,
    theme: tree.theme,
    canvasState: tree.canvasState as Record<string, unknown> | null,
    nodes: nodesWithStatus,
    edges: edgesData,
  };

  return <SkillTreeEditor tree={treeData} />;
}
