import type { EdgeType, SkillEdgeData, SkillNodeData, SkillTreeData, ShareMode } from "@/types";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

type PortableTreeMeta = {
  title: string;
  description: string | null;
  theme: string;
  canvasState: Record<string, unknown> | null;
};

type BackupTreeMeta = PortableTreeMeta & {
  slug: string;
  isPublic: boolean;
  shareMode: ShareMode;
};

type PortableNode = Omit<SkillNodeData, "treeId">;
type PortableEdge = Omit<SkillEdgeData, "treeId">;

export interface PortableTreeExport {
  version: 1;
  format: "portable";
  tree: PortableTreeMeta;
  nodes: PortableNode[];
  edges: PortableEdge[];
}

export interface BackupTreeExport {
  version: 1;
  format: "backup";
  tree: BackupTreeMeta;
  nodes: PortableNode[];
  edges: PortableEdge[];
}

export type ParsedTreeImport = PortableTreeExport | BackupTreeExport;

export function buildPortableTreeExport(tree: SkillTreeData): PortableTreeExport {
  return {
    version: 1,
    format: "portable",
    tree: {
      title: tree.title,
      description: tree.description,
      theme: tree.theme,
      canvasState: tree.canvasState,
    },
    nodes: tree.nodes.map((node) => stripTreeIdFromNode(node)),
    edges: tree.edges.map((edge) => stripTreeIdFromEdge(edge)),
  };
}

export function buildBackupTreeExport(tree: SkillTreeData): BackupTreeExport {
  return {
    version: 1,
    format: "backup",
    tree: {
      title: tree.title,
      description: tree.description,
      theme: tree.theme,
      canvasState: tree.canvasState,
      slug: tree.slug,
      isPublic: tree.isPublic,
      shareMode: tree.shareMode ?? (tree.isPublic ? "public_readonly" : "private"),
    },
    nodes: tree.nodes.map((node) => stripTreeIdFromNode(node)),
    edges: tree.edges.map((edge) => stripTreeIdFromEdge(edge)),
  };
}

export function parseTreeImport(json: string): ParsedTreeImport {
  const parsed = JSON.parse(json) as JsonValue;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Import payload must be an object");
  }

  const root = parsed as Record<string, JsonValue>;
  if (root.version !== 1) throw new Error("Unsupported import version");
  if (root.format !== "portable" && root.format !== "backup") {
    throw new Error("Import format must be portable or backup");
  }
  if (!root.tree || typeof root.tree !== "object" || Array.isArray(root.tree)) {
    throw new Error("Import tree metadata is missing");
  }
  if (!Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error("Import must include nodes and edges arrays");
  }

  const nodeIds = new Set<string>();
  for (const node of root.nodes) {
    assertPortableNode(node);
    nodeIds.add(node.id as string);
  }

  for (const edge of root.edges) {
    assertPortableEdge(edge);
    if (
      !nodeIds.has(edge.sourceNodeId as string) ||
      !nodeIds.has(edge.targetNodeId as string)
    ) {
      throw new Error("Import edge references missing nodes");
    }
  }

  if (root.format === "backup") {
    const tree = root.tree as Record<string, JsonValue>;
    if (typeof tree.slug !== "string") throw new Error("Backup import requires slug");
    if (typeof tree.isPublic !== "boolean") throw new Error("Backup import requires isPublic");
    if (!isShareMode(tree.shareMode)) throw new Error("Backup import requires valid shareMode");
  }

  return root as unknown as ParsedTreeImport;
}

export function materializeImportedTree(
  parsed: ParsedTreeImport,
  options: {
    createId: () => string;
    allowShareMetadata: boolean;
    userId?: string;
  }
) {
  const nodeIdMap = new Map<string, string>();
  const treeId = options.createId();

  for (const node of parsed.nodes) {
    nodeIdMap.set(node.id, options.createId());
  }

  const nodes = parsed.nodes.map((node) => ({
    ...node,
    id: nodeIdMap.get(node.id) ?? options.createId(),
    treeId,
    parentId: node.parentId ? nodeIdMap.get(node.parentId) ?? null : null,
  }));

  const edges = parsed.edges.map((edge) => ({
    ...edge,
    id: options.createId(),
    treeId,
    sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
    targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
  }));

  const backupMeta = parsed.format === "backup" ? parsed.tree : null;
  const shareMode =
    backupMeta && options.allowShareMetadata
      ? backupMeta.shareMode
      : "private";
  const isPublic =
    backupMeta && options.allowShareMetadata
      ? backupMeta.isPublic
      : false;

  return {
    tree: {
      id: treeId,
      userId: options.userId ?? "",
      title: parsed.tree.title,
      description: parsed.tree.description,
      slug: backupMeta?.slug ?? "",
      isPublic,
      shareMode,
      theme: parsed.tree.theme,
      canvasState: parsed.tree.canvasState,
    },
    nodes,
    edges,
  };
}

function assertPortableNode(node: JsonValue): asserts node is JsonRecord {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new Error("Import node must be an object");
  }
  const entry = node as JsonRecord;
  if (typeof entry.id !== "string" || typeof entry.title !== "string") {
    throw new Error("Import node must include id and title");
  }
  if (typeof entry.positionX !== "number" || typeof entry.positionY !== "number") {
    throw new Error("Import node must include numeric positions");
  }
}

function assertPortableEdge(edge: JsonValue): asserts edge is JsonRecord {
  if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
    throw new Error("Import edge must be an object");
  }
  const entry = edge as JsonRecord;
  if (
    typeof entry.id !== "string" ||
    typeof entry.sourceNodeId !== "string" ||
    typeof entry.targetNodeId !== "string" ||
    !isEdgeType(entry.type)
  ) {
    throw new Error("Import edge must include valid ids and type");
  }
}

function isEdgeType(value: JsonValue): value is EdgeType {
  return value === "prerequisite" || value === "recommended" || value === "optional";
}

function isShareMode(value: JsonValue): value is ShareMode {
  return value === "private" || value === "public_readonly" || value === "public_edit";
}

function stripTreeIdFromNode(node: SkillNodeData): PortableNode {
  const { treeId, ...portableNode } = node;
  void treeId;
  return portableNode;
}

function stripTreeIdFromEdge(edge: SkillEdgeData): PortableEdge {
  const { treeId, ...portableEdge } = edge;
  void treeId;
  return portableEdge;
}
