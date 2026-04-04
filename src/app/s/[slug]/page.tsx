import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";
import { PublicTreeView } from "./public-view";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  if (!tree) return { title: "Not Found" };
  return { title: `${tree.title} — SkillTree`, description: tree.description || `Skill tree: ${tree.title}` };
}

export default async function PublicViewPage({ params }: { params: { slug: string } }) {
  const { slug } = await params;
  const tree = await prisma.skillTree.findUnique({
    where: { slug },
    include: { nodes: true, edges: true, user: { select: { name: true } } },
  });

  if (!tree || !tree.isPublic) notFound();

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
  const nodesWithStatus = nodesData.map((n) => ({ ...n, status: statuses.get(n.id) || n.status }));

  return <PublicTreeView title={tree.title} authorName={tree.user.name} nodes={nodesWithStatus} edges={edgesData} />;
}
