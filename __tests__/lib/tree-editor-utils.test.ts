import { findAvailableNodePosition, mergeNodeUpdates } from "@/lib/tree-editor-utils";
import type { SkillNodeData } from "@/types";

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
