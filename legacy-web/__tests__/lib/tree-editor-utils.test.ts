import {
  applyNodeUpdateWithStatuses,
  findAvailableNodePosition,
  mergeNodeUpdates,
} from "@/lib/tree-editor-utils";
import type { SkillEdgeData, SkillNodeData } from "@/types";

const existingNode: SkillNodeData = {
  id: "node-1",
  treeId: "tree-1",
  parentId: null,
  title: "Original",
  description: "Old description",
  difficulty: 2,
  estimatedHours: 3,
  progress: 20,
  status: "in_progress",
  positionX: 420,
  positionY: 180,
  style: null,
  subTasks: [],
  resources: [],
  notes: null,
  subTreeId: null,
};

const dependentNode: SkillNodeData = {
  ...existingNode,
  id: "node-2",
  title: "Dependent",
  progress: 0,
  status: "locked",
  positionX: 680,
  positionY: 180,
};

const prerequisiteEdge: SkillEdgeData = {
  id: "edge-1",
  treeId: "tree-1",
  sourceNodeId: "node-1",
  targetNodeId: "node-2",
  type: "prerequisite",
  style: null,
};

describe("mergeNodeUpdates", () => {
  it("updates node content without changing layout when positions are omitted", () => {
    const result = mergeNodeUpdates([existingNode], [
      {
        id: "node-1",
        title: "Enhanced",
        description: "New description",
        difficulty: 4,
      },
    ]);

    expect(result[0]).toMatchObject({
      id: "node-1",
      title: "Enhanced",
      description: "New description",
      difficulty: 4,
      positionX: 420,
      positionY: 180,
    });
  });
});

describe("findAvailableNodePosition", () => {
  it("places a new node below the anchor by default", () => {
    const result = findAvailableNodePosition(
      [existingNode],
      { anchorNodeId: "node-1", direction: "below" }
    );

    expect(result).toEqual({ x: 400, y: 400 });
  });

  it("spreads sideways when the preferred slot is occupied", () => {
    const result = findAvailableNodePosition(
      [
        existingNode,
        {
          ...existingNode,
          id: "node-2",
          positionX: 400,
          positionY: 400,
        },
      ],
      { anchorNodeId: "node-1", direction: "below" }
    );

    expect(result.y).toBe(400);
    expect(result.x).not.toBe(400);
  });
});

describe("applyNodeUpdateWithStatuses", () => {
  it("applies a status change immediately and recomputes dependent nodes", () => {
    const result = applyNodeUpdateWithStatuses(
      [
        { ...existingNode, status: "available", progress: 0 },
        dependentNode,
      ],
      { ...existingNode, status: "completed", progress: 100 },
      [prerequisiteEdge]
    );

    expect(result.find((node) => node.id === "node-1")?.status).toBe("completed");
    expect(result.find((node) => node.id === "node-2")?.status).toBe("available");
  });
});
