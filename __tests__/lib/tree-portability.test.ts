import {
  buildBackupTreeExport,
  buildPortableTreeExport,
  materializeImportedTree,
  parseTreeImport,
} from "@/lib/tree-portability";
import type { SkillTreeData } from "@/types";

const sampleTree: SkillTreeData = {
  id: "tree-1",
  userId: "user-1",
  title: "Rust Path",
  description: "Learn Rust",
  slug: "rust-path",
  isPublic: true,
  shareMode: "public_edit",
  theme: "rpg-dark",
  canvasState: { x: 0, y: 0, zoom: 1 },
  nodes: [
    {
      id: "node-a",
      treeId: "tree-1",
      parentId: null,
      title: "Borrow Checker",
      description: "Ownership rules",
      difficulty: 4,
      estimatedHours: 6,
      progress: 30,
      status: "in_progress",
      positionX: 100,
      positionY: 200,
      style: null,
      subTasks: [{ title: "Read the book chapter", done: true }],
      resources: [{ title: "The Book", url: "https://doc.rust-lang.org/book/" }],
      notes: "Important",
      subTreeId: null,
    },
    {
      id: "node-b",
      treeId: "tree-1",
      parentId: null,
      title: "Lifetimes",
      description: null,
      difficulty: 5,
      estimatedHours: 8,
      progress: 0,
      status: "locked",
      positionX: 300,
      positionY: 200,
      style: null,
      subTasks: [],
      resources: [],
      notes: null,
      subTreeId: null,
    },
  ],
  edges: [
    {
      id: "edge-1",
      treeId: "tree-1",
      sourceNodeId: "node-a",
      targetNodeId: "node-b",
      type: "prerequisite",
      style: null,
    },
  ],
};

describe("tree portability", () => {
  it("creates portable exports without share metadata", () => {
    const portable = buildPortableTreeExport(sampleTree);

    expect(portable.format).toBe("portable");
    expect(portable.tree).not.toHaveProperty("slug");
    expect(portable.tree).not.toHaveProperty("shareMode");
    expect(portable.tree).not.toHaveProperty("isPublic");
  });

  it("creates backup exports with share metadata", () => {
    const backup = buildBackupTreeExport(sampleTree);

    expect(backup.format).toBe("backup");
    expect(backup.tree.slug).toBe("rust-path");
    expect(backup.tree.shareMode).toBe("public_edit");
    expect(backup.tree.isPublic).toBe(true);
  });

  it("rejects imports with dangling edges", () => {
    const invalid = JSON.stringify({
      format: "portable",
      version: 1,
      tree: { title: "Broken", description: null, theme: "rpg-dark", canvasState: null },
      nodes: [],
      edges: [{ id: "edge-1", sourceNodeId: "missing-a", targetNodeId: "missing-b", type: "prerequisite" }],
    });

    expect(() => parseTreeImport(invalid)).toThrow("references missing nodes");
  });

  it("remaps ids and strips share metadata when share import is not allowed", () => {
    const parsed = parseTreeImport(JSON.stringify(buildBackupTreeExport(sampleTree)));
    const ids = ["tree-new", "node-new-a", "node-new-b", "edge-new-1"];
    const nextId = () => ids.shift() ?? "fallback-id";

    const materialized = materializeImportedTree(parsed, {
      createId: nextId,
      allowShareMetadata: false,
    });

    expect(materialized.tree.id).toBe("tree-new");
    expect(materialized.tree.shareMode).toBe("private");
    expect(materialized.tree.isPublic).toBe(false);
    expect(materialized.nodes.map((node) => node.id)).toEqual(["node-new-a", "node-new-b"]);
    expect(materialized.edges[0]).toMatchObject({
      id: "edge-new-1",
      sourceNodeId: "node-new-a",
      targetNodeId: "node-new-b",
    });
  });
});
