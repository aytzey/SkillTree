import type { SkillNodeData, SkillEdgeData, NodeStatus, SubTask } from "@/types";

export function computeNodeStatuses(
  nodes: SkillNodeData[],
  edges: SkillEdgeData[]
): Map<string, NodeStatus> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const resolved = new Map<string, NodeStatus>();
  const visiting = new Set<string>();

  const prereqs = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== "prerequisite") continue;
    const existing = prereqs.get(edge.targetNodeId) || [];
    existing.push(edge.sourceNodeId);
    prereqs.set(edge.targetNodeId, existing);
  }

  function resolveNodeStatus(nodeId: string): NodeStatus {
    const cached = resolved.get(nodeId);
    if (cached) return cached;

    const node = nodeMap.get(nodeId);
    if (!node) return "locked";

    if (visiting.has(nodeId)) {
      return computeIntrinsicStatus(node);
    }

    visiting.add(nodeId);

    const prereqIds = prereqs.get(nodeId) || [];
    if (prereqIds.length === 0) {
      const intrinsic = computeIntrinsicStatus(node);
      resolved.set(nodeId, intrinsic);
      visiting.delete(nodeId);
      return intrinsic;
    }

    const allPrereqsComplete = prereqIds.every((id) => {
      return resolveNodeStatus(id) === "completed";
    });

    const nextStatus = allPrereqsComplete ? computeIntrinsicStatus(node) : "locked";
    resolved.set(nodeId, nextStatus);
    visiting.delete(nodeId);
    return nextStatus;
  }

  for (const node of nodes) {
    resolveNodeStatus(node.id);
  }

  return resolved;
}

export function computeProgressFromSubtasks(subTasks: SubTask[]): number {
  if (subTasks.length === 0) return -1;
  const done = subTasks.filter((t) => t.done).length;
  return Math.round((done / subTasks.length) * 100);
}

function computeIntrinsicStatus(node: SkillNodeData): NodeStatus {
  const subTaskProgress = computeProgressFromSubtasks(node.subTasks);
  const effectiveProgress = subTaskProgress >= 0 ? subTaskProgress : node.progress;

  if (effectiveProgress >= 100) return "completed";
  if (effectiveProgress > 0) return "in_progress";

  if (node.status === "completed" || node.status === "in_progress") {
    return node.status;
  }

  return "available";
}
