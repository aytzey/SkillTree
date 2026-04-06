import type { SkillNodeData } from "@/types";

type NodeUpdate = Partial<SkillNodeData> & Pick<SkillNodeData, "id">;
type PlacementDirection = "above" | "below" | "parallel";

const GRID_SIZE = 50;
const HORIZONTAL_GAP = 260;
const VERTICAL_GAP = 200;
const HORIZONTAL_COLLISION = 180;
const VERTICAL_COLLISION = 150;

export function mergeNodeUpdates(
  existingNodes: SkillNodeData[],
  updates: NodeUpdate[]
): SkillNodeData[] {
  const updateMap = new Map(updates.map((update) => [update.id, update]));

  return existingNodes.map((node) => {
    const update = updateMap.get(node.id);
    if (!update) return node;

    return {
      ...node,
      ...update,
      positionX: update.positionX ?? node.positionX,
      positionY: update.positionY ?? node.positionY,
    };
  });
}

export function findAvailableNodePosition(
  nodes: Array<Pick<SkillNodeData, "id" | "positionX" | "positionY">>,
  options: {
    anchorNodeId?: string | null;
    direction: PlacementDirection;
  }
) {
  if (nodes.length === 0) {
    return { x: 300, y: 300 };
  }

  const anchor = options.anchorNodeId
    ? nodes.find((node) => node.id === options.anchorNodeId) ?? null
    : null;

  const basePosition = anchor
    ? getAnchoredBasePosition(anchor, options.direction)
    : getDetachedBasePosition(nodes);

  const spreadAxis = anchor && options.direction !== "parallel" ? "x" : "y";

  for (let step = 0; step < 12; step += 1) {
    const candidates = step === 0
      ? [basePosition]
      : [
          offsetPosition(basePosition, spreadAxis, step),
          offsetPosition(basePosition, spreadAxis, -step),
        ];

    for (const candidate of candidates) {
      if (!isPositionOccupied(nodes, candidate)) {
        return candidate;
      }
    }
  }

  return basePosition;
}

function getAnchoredBasePosition(
  anchor: Pick<SkillNodeData, "positionX" | "positionY">,
  direction: PlacementDirection
) {
  if (direction === "above") {
    return snapPosition({ x: anchor.positionX, y: anchor.positionY - VERTICAL_GAP });
  }

  if (direction === "below") {
    return snapPosition({ x: anchor.positionX, y: anchor.positionY + VERTICAL_GAP });
  }

  return snapPosition({ x: anchor.positionX + HORIZONTAL_GAP, y: anchor.positionY });
}

function getDetachedBasePosition(
  nodes: Array<Pick<SkillNodeData, "positionX" | "positionY">>
) {
  const maxX = Math.max(...nodes.map((node) => node.positionX));
  const avgY = nodes.reduce((sum, node) => sum + node.positionY, 0) / nodes.length;
  return snapPosition({ x: maxX + HORIZONTAL_GAP, y: avgY });
}

function offsetPosition(
  position: { x: number; y: number },
  axis: "x" | "y",
  step: number
) {
  if (axis === "x") {
    return snapPosition({ x: position.x + step * HORIZONTAL_GAP, y: position.y });
  }

  return snapPosition({ x: position.x, y: position.y + step * VERTICAL_GAP });
}

function isPositionOccupied(
  nodes: Array<Pick<SkillNodeData, "positionX" | "positionY">>,
  candidate: { x: number; y: number }
) {
  return nodes.some((node) => (
    Math.abs(node.positionX - candidate.x) < HORIZONTAL_COLLISION &&
    Math.abs(node.positionY - candidate.y) < VERTICAL_COLLISION
  ));
}

function snapPosition(position: { x: number; y: number }) {
  return {
    x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
  };
}
