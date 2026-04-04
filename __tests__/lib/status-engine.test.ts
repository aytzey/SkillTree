import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";

function makeNode(overrides: Partial<SkillNodeData> & { id: string }): SkillNodeData {
  return {
    treeId: "tree1", parentId: null, title: "Node", description: null,
    difficulty: 1, estimatedHours: null, progress: 0, status: "locked",
    positionX: 0, positionY: 0, style: null, subTasks: [], resources: [],
    notes: null, subTreeId: null, ...overrides,
  };
}

function makeEdge(source: string, target: string, type: "prerequisite" | "recommended" | "optional" = "prerequisite"): SkillEdgeData {
  return { id: `${source}-${target}`, treeId: "tree1", sourceNodeId: source, targetNodeId: target, type, style: null };
}

describe("computeNodeStatuses", () => {
  it("marks root node with no prerequisites as available", () => {
    const nodes = [makeNode({ id: "a" })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("available");
  });

  it("marks node as locked when prerequisite is not completed", () => {
    const nodes = [makeNode({ id: "a", status: "available" }), makeNode({ id: "b" })];
    const edges = [makeEdge("a", "b")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("locked");
  });

  it("marks node as available when all prerequisites are completed", () => {
    const nodes = [
      makeNode({ id: "a", progress: 100, subTasks: [{ title: "x", done: true }] }),
      makeNode({ id: "b" }),
    ];
    const edges = [makeEdge("a", "b")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("available");
  });

  it("marks node as in_progress when some sub-tasks are done", () => {
    const nodes = [makeNode({ id: "a", subTasks: [{ title: "x", done: true }, { title: "y", done: false }] })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("in_progress");
  });

  it("marks node as completed when all sub-tasks done and progress is 100", () => {
    const nodes = [makeNode({ id: "a", progress: 100, subTasks: [{ title: "x", done: true }] })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("completed");
  });

  it("ignores recommended/optional edges for lock calculation", () => {
    const nodes = [makeNode({ id: "a" }), makeNode({ id: "b" })];
    const edges = [makeEdge("a", "b", "recommended")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("available");
  });

  it("handles chain: a -> b -> c", () => {
    const nodes = [
      makeNode({ id: "a", progress: 100, subTasks: [{ title: "x", done: true }] }),
      makeNode({ id: "b" }),
      makeNode({ id: "c" }),
    ];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("a")).toBe("completed");
    expect(result.get("b")).toBe("available");
    expect(result.get("c")).toBe("locked");
  });

  it("node with no sub-tasks uses progress only — 100 = completed", () => {
    const nodes = [makeNode({ id: "a", progress: 100 })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("completed");
  });

  it("node with no sub-tasks and progress 0 is available (if no prereqs)", () => {
    const nodes = [makeNode({ id: "a", progress: 0 })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("available");
  });
});
