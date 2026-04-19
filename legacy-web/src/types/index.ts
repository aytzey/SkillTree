export type NodeStatus = "locked" | "available" | "in_progress" | "completed";
export type EdgeType = "prerequisite" | "recommended" | "optional";
export type ShareMode = "private" | "public_readonly" | "public_edit";

export interface SubTask {
  title: string;
  done: boolean;
}

export interface Resource {
  title: string;
  url: string;
}

export interface SkillNodeData {
  id: string;
  treeId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  difficulty: number;
  estimatedHours: number | null;
  progress: number;
  status: NodeStatus;
  positionX: number;
  positionY: number;
  style: Record<string, unknown> | null;
  subTasks: SubTask[];
  resources: Resource[];
  notes: string | null;
  subTreeId: string | null;
}

export interface SkillEdgeData {
  id: string;
  treeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  style: Record<string, unknown> | null;
}

export interface SkillTreeData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  slug: string;
  isPublic: boolean;
  shareMode: ShareMode;
  theme: string;
  canvasState: Record<string, unknown> | null;
  nodes: SkillNodeData[];
  edges: SkillEdgeData[];
}
