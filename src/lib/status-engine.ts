import type { SkillNodeData, SkillEdgeData, NodeStatus, SubTask } from "@/types";

export function computeNodeStatuses(
  nodes: SkillNodeData[],
  edges: SkillEdgeData[]
): Map<string, NodeStatus> {
  const result = new Map<string, NodeStatus>();

  // Build prerequisite map: targetNodeId -> [sourceNodeIds]
  const prereqs = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== "prerequisite") continue;
    const existing = prereqs.get(edge.targetNodeId) || [];
    existing.push(edge.sourceNodeId);
    prereqs.set(edge.targetNodeId, existing);
  }

  // Compute intrinsic status for each node (ignoring prerequisites)
  const intrinsic = new Map<string, NodeStatus>();
  for (const node of nodes) {
    intrinsic.set(node.id, computeIntrinsicStatus(node));
  }

  // Determine final status considering prerequisites
  for (const node of nodes) {
    const prereqIds = prereqs.get(node.id) || [];
    if (prereqIds.length === 0) {
      result.set(node.id, intrinsic.get(node.id)!);
      continue;
    }

    const allPrereqsComplete = prereqIds.every(
      (id) => intrinsic.get(id) === "completed"
    );
    if (!allPrereqsComplete) {
      result.set(node.id, "locked");
    } else {
      result.set(node.id, intrinsic.get(node.id)!);
    }
  }

  return result;
}

function computeIntrinsicStatus(node: SkillNodeData): NodeStatus {
  const subTasks = node.subTasks as SubTask[];
  const hasSubTasks = subTasks.length > 0;

  if (hasSubTasks) {
    const allDone = subTasks.every((t) => t.done);
    const someDone = subTasks.some((t) => t.done);
    if (allDone && node.progress >= 100) return "completed";
    if (someDone) return "in_progress";
    return "available";
  }

  // No sub-tasks: use progress only
  if (node.progress >= 100) return "completed";
  return "available";
}
