import type { SkillEdgeData, SkillNodeData, SkillTreeData, ShareMode } from "@/types";

interface TreeRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  slug: string;
  isPublic: boolean;
  shareMode?: ShareMode | null;
  editTokenHash?: string | null;
  theme: string;
  canvasState: Record<string, unknown> | null;
  nodes: Array<{
    id: string;
    treeId: string;
    parentId: string | null;
    title: string;
    description: string | null;
    difficulty: number;
    estimatedHours: number | null;
    progress: number;
    status: string;
    positionX: number;
    positionY: number;
    style: Record<string, unknown> | null;
    subTasks: unknown;
    resources: unknown;
    notes: string | null;
    subTreeId: string | null;
  }>;
  edges: Array<{
    id: string;
    treeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    type: string;
    style: Record<string, unknown> | null;
  }>;
}

export function toSkillTreeData(tree: TreeRecord): SkillTreeData {
  const nodes: SkillNodeData[] = tree.nodes.map((node) => ({
    ...node,
    status: node.status as SkillNodeData["status"],
    subTasks: (node.subTasks as SkillNodeData["subTasks"]) || [],
    resources: (node.resources as SkillNodeData["resources"]) || [],
    style: node.style,
  }));

  const edges: SkillEdgeData[] = tree.edges.map((edge) => ({
    ...edge,
    type: edge.type as SkillEdgeData["type"],
    style: edge.style,
  }));

  return {
    id: tree.id,
    userId: tree.userId,
    title: tree.title,
    description: tree.description,
    slug: tree.slug,
    isPublic: tree.isPublic,
    shareMode: tree.shareMode ?? (tree.isPublic ? "public_readonly" : "private"),
    theme: tree.theme,
    canvasState: tree.canvasState,
    nodes,
    edges,
  };
}
