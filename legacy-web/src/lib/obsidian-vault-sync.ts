import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { buildBackupTreeExport, parseTreeImport } from "@/lib/tree-portability";
import type {
  EdgeType,
  Resource,
  SkillEdgeData,
  SkillNodeData,
  SkillTreeData,
  SubTask,
} from "@/types";

const DEFAULT_OBSIDIAN_ROOT = "SkillTree";
const MANIFEST_FILE_NAME = "_skilltree.json";
const TREE_NOTE_FILE_NAME = "tree.md";

type Frontmatter = Record<string, unknown>;

interface ObsidianManifestMeta {
  appTreeId: string;
  appUserId: string;
  rootFolder: string;
  treeNotePath: string;
  nodePaths: Record<string, string>;
  generatedAt: string;
}

type ObsidianTreeManifest = ReturnType<typeof buildBackupTreeExport> & {
  obsidian: ObsidianManifestMeta;
};

interface ParsedNodeNote {
  node: SkillNodeData;
  dependencies: Record<EdgeType, string[]>;
  hasDependencyMetadata: boolean;
}

export class ObsidianVaultNotConfiguredError extends Error {
  constructor() {
    super("OBSIDIAN_VAULT_PATH is not configured");
    this.name = "ObsidianVaultNotConfiguredError";
  }
}

export function getObsidianVaultConfig() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH?.trim();
  if (!vaultPath) throw new ObsidianVaultNotConfiguredError();

  return {
    vaultPath,
    rootFolder: (process.env.SKILLTREE_OBSIDIAN_ROOT || DEFAULT_OBSIDIAN_ROOT).trim() || DEFAULT_OBSIDIAN_ROOT,
  };
}

export async function writeTreeToObsidianVault(tree: SkillTreeData) {
  const { vaultPath, rootFolder } = getObsidianVaultConfig();
  const treeFolder = `${rootFolder}/${slugifyPathSegment(tree.slug || tree.title, tree.id)}`;
  const treeNotePath = `${treeFolder}/${TREE_NOTE_FILE_NAME}`;
  const manifestPath = `${treeFolder}/${MANIFEST_FILE_NAME}`;
  const nodePaths = buildNodePaths(tree, treeFolder);
  const previousManifest = await readManifestAtPath(vaultPath, manifestPath).catch(() => null);

  await ensureVaultDir(vaultPath, treeFolder);
  await writeVaultFile(vaultPath, treeNotePath, renderTreeNote(tree));

  for (const node of tree.nodes) {
    const nodePath = nodePaths[node.id];
    if (!nodePath) continue;
    await ensureVaultDir(vaultPath, path.posix.dirname(nodePath));
    await writeVaultFile(vaultPath, nodePath, renderNodeNote(tree, node));
  }

  await deleteStaleNodeNotes(vaultPath, previousManifest?.obsidian.nodePaths ?? {}, nodePaths);

  const manifest: ObsidianTreeManifest = {
    ...buildBackupTreeExport(tree),
    obsidian: {
      appTreeId: tree.id,
      appUserId: tree.userId,
      rootFolder,
      treeNotePath,
      nodePaths,
      generatedAt: new Date().toISOString(),
    },
  };

  await writeVaultFile(vaultPath, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    manifestPath,
    treeNotePath,
    nodeCount: tree.nodes.length,
  };
}

export async function readTreeFromObsidianVault(treeId: string, userId: string): Promise<SkillTreeData> {
  const { vaultPath, rootFolder } = getObsidianVaultConfig();
  const manifestPath = await findManifestPathForTree(vaultPath, rootFolder, treeId);
  if (!manifestPath) {
    throw new Error(`No Obsidian mirror found for tree ${treeId}`);
  }

  const manifest = await readManifestAtPath(vaultPath, manifestPath);
  const parsed = parseTreeImport(JSON.stringify(manifest));
  const treeRoot = path.posix.dirname(manifestPath);
  const treeIdFromManifest = manifest.obsidian?.appTreeId || treeId;

  let tree: SkillTreeData = {
    id: treeIdFromManifest,
    userId,
    title: parsed.tree.title,
    description: parsed.tree.description,
    slug: parsed.format === "backup" ? parsed.tree.slug : slugifyPathSegment(parsed.tree.title, treeIdFromManifest),
    isPublic: parsed.format === "backup" ? parsed.tree.isPublic : false,
    shareMode: parsed.format === "backup" ? parsed.tree.shareMode : "private",
    theme: parsed.tree.theme,
    canvasState: parsed.tree.canvasState,
    nodes: parsed.nodes.map((node) => ({ ...node, treeId: treeIdFromManifest })),
    edges: parsed.edges.map((edge) => ({ ...edge, treeId: treeIdFromManifest })),
  };

  const treeNote = await readVaultFile(vaultPath, manifest.obsidian?.treeNotePath ?? `${treeRoot}/${TREE_NOTE_FILE_NAME}`).catch(() => null);
  if (treeNote) {
    tree = applyTreeNote(tree, treeNote);
  }

  const parsedNotes: ParsedNodeNote[] = [];
  const nodePaths = await collectNodeNotePaths(vaultPath, treeRoot, manifest);
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]));

  for (const relativePath of nodePaths) {
    const markdown = await readVaultFile(vaultPath, relativePath).catch(() => null);
    if (!markdown) continue;
    const parsedNode = parseNodeNote(markdown, nodesById.get(readNodeIdFromMarkdown(markdown) ?? ""), treeIdFromManifest);
    if (!parsedNode) continue;
    parsedNotes.push(parsedNode);
    nodesById.set(parsedNode.node.id, parsedNode.node);
  }

  if (parsedNotes.length > 0) {
    const manifestOrder = new Map(tree.nodes.map((node, index) => [node.id, index]));
    tree = {
      ...tree,
      nodes: [...nodesById.values()].sort((a, b) => {
        const aOrder = manifestOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = manifestOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.title.localeCompare(b.title);
      }),
    };
  }

  if (parsedNotes.some((note) => note.hasDependencyMetadata)) {
    tree = {
      ...tree,
      edges: buildEdgesFromNodeNotes(tree.id, parsedNotes),
    };
  }

  return tree;
}

function renderTreeNote(tree: SkillTreeData) {
  const frontmatter = renderFrontmatter({
    skilltreeKind: "tree",
    treeId: tree.id,
    title: tree.title,
    slug: tree.slug,
    theme: tree.theme,
    shareMode: tree.shareMode,
    isPublic: tree.isPublic,
    canvasStateJson: tree.canvasState,
  });

  return [
    frontmatter,
    `# ${tree.title}`,
    "",
    tree.description?.trim() || "",
    "",
    "## Skill Tree",
    "",
    "This note is the Obsidian entry point for the SkillTree mirror. Node notes below this folder are the editable skill items.",
    "",
  ].join("\n");
}

function renderNodeNote(tree: SkillTreeData, node: SkillNodeData) {
  const dependencies = getNodeDependencies(tree.edges, node.id);
  const frontmatter = renderFrontmatter({
    skilltreeKind: "node",
    treeId: tree.id,
    nodeId: node.id,
    parentId: node.parentId,
    title: node.title,
    status: node.status,
    difficulty: node.difficulty,
    estimatedHours: node.estimatedHours,
    progress: node.progress,
    positionX: node.positionX,
    positionY: node.positionY,
    subTreeId: node.subTreeId,
    requires: dependencies.prerequisite,
    recommended: dependencies.recommended,
    optional: dependencies.optional,
    styleJson: node.style,
  });

  return [
    frontmatter,
    `# ${node.title}`,
    "",
    node.description?.trim() || "",
    "",
    "## Subtasks",
    "",
    ...(node.subTasks.length > 0
      ? node.subTasks.map((task) => `- [${task.done ? "x" : " "}] ${task.title}`)
      : [""]),
    "",
    "## Notes",
    "",
    node.notes?.trim() || "",
    "",
    "## Resources",
    "",
    ...(node.resources.length > 0
      ? node.resources.map((resource) => `- [${resource.title}](${resource.url})`)
      : [""]),
    "",
  ].join("\n");
}

function renderFrontmatter(values: Frontmatter) {
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`);
  return ["---", ...lines, "---", ""].join("\n");
}

function formatFrontmatterValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function applyTreeNote(tree: SkillTreeData, markdown: string): SkillTreeData {
  const { frontmatter, body } = parseMarkdownDocument(markdown);
  const title = asString(frontmatter.title) || readFirstHeading(body) || tree.title;
  const description = readBodyBeforeSections(body) || tree.description;
  const canvasState = parseJsonishObject(frontmatter.canvasStateJson) ?? tree.canvasState;

  return {
    ...tree,
    title,
    description,
    theme: asString(frontmatter.theme) || tree.theme,
    canvasState,
  };
}

function parseNodeNote(markdown: string, existingNode: SkillNodeData | undefined, treeId: string): ParsedNodeNote | null {
  const { frontmatter, body } = parseMarkdownDocument(markdown);
  if (frontmatter.skilltreeKind !== "node" && frontmatter.skilltree_kind !== "node") return null;

  const nodeId = asString(frontmatter.nodeId) || existingNode?.id || `obsidian-${stableHash(markdown).slice(0, 12)}`;
  const title = asString(frontmatter.title) || readFirstHeading(body) || existingNode?.title || "Untitled Skill";
  const subTasks = parseSubtasks(readSection(body, "Subtasks")) ?? existingNode?.subTasks ?? [];
  const resources = parseResources(readSection(body, "Resources")) ?? existingNode?.resources ?? [];
  const notes = readSection(body, "Notes")?.trim() || existingNode?.notes || null;
  const description = readBodyBeforeSections(body) || existingNode?.description || null;
  const dependencyMetadata = {
    prerequisite: parseStringArray(frontmatter.requires),
    recommended: parseStringArray(frontmatter.recommended),
    optional: parseStringArray(frontmatter.optional),
  };
  const hasDependencyMetadata =
    "requires" in frontmatter || "recommended" in frontmatter || "optional" in frontmatter;

  return {
    node: {
      id: nodeId,
      treeId,
      parentId: asNullableString(frontmatter.parentId) ?? existingNode?.parentId ?? null,
      title,
      description,
      difficulty: asNumber(frontmatter.difficulty) ?? existingNode?.difficulty ?? 1,
      estimatedHours: asNullableNumber(frontmatter.estimatedHours) ?? existingNode?.estimatedHours ?? null,
      progress: clampProgress(asNumber(frontmatter.progress) ?? existingNode?.progress ?? progressFromSubtasks(subTasks)),
      status: normalizeStatus(asString(frontmatter.status) || existingNode?.status),
      positionX: asNumber(frontmatter.positionX) ?? existingNode?.positionX ?? 0,
      positionY: asNumber(frontmatter.positionY) ?? existingNode?.positionY ?? 0,
      style: parseJsonishObject(frontmatter.styleJson) ?? existingNode?.style ?? null,
      subTasks,
      resources,
      notes,
      subTreeId: asNullableString(frontmatter.subTreeId) ?? existingNode?.subTreeId ?? null,
    },
    dependencies: dependencyMetadata,
    hasDependencyMetadata,
  };
}

function buildNodePaths(tree: SkillTreeData, treeFolder: string) {
  const parentByNode = buildFolderParentMap(tree);
  const childrenByParent = new Map<string | null, SkillNodeData[]>();
  for (const node of tree.nodes) {
    const parentId = parentByNode.get(node.id) ?? null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareNodesForPath);
  }

  const segmentByNode = new Map<string, string>();
  for (const [parentId, siblings] of childrenByParent.entries()) {
    void parentId;
    siblings.forEach((node, index) => {
      segmentByNode.set(node.id, `${String(index + 1).padStart(2, "0")}-${slugifyPathSegment(node.title, node.id)}`);
    });
  }

  const nodePaths: Record<string, string> = {};
  const resolveFolderParts = (nodeId: string, seen = new Set<string>()): string[] => {
    if (seen.has(nodeId)) return [];
    seen.add(nodeId);
    const parentId = parentByNode.get(nodeId);
    if (!parentId) return [];
    const parentSegment = segmentByNode.get(parentId);
    if (!parentSegment) return [];
    return [...resolveFolderParts(parentId, seen), parentSegment];
  };

  for (const node of tree.nodes) {
    const segment = segmentByNode.get(node.id) ?? slugifyPathSegment(node.title, node.id);
    nodePaths[node.id] = path.posix.join(treeFolder, ...resolveFolderParts(node.id), `${segment}.md`);
  }

  return nodePaths;
}

function buildFolderParentMap(tree: SkillTreeData) {
  const nodeIds = new Set(tree.nodes.map((node) => node.id));
  const parentByNode = new Map<string, string | null>();
  const incomingPrerequisites = new Map<string, string[]>();

  for (const edge of tree.edges) {
    if (edge.type !== "prerequisite") continue;
    const existing = incomingPrerequisites.get(edge.targetNodeId) ?? [];
    existing.push(edge.sourceNodeId);
    incomingPrerequisites.set(edge.targetNodeId, existing);
  }

  for (const node of tree.nodes) {
    if (node.parentId && nodeIds.has(node.parentId) && !wouldCreateCycle(node.id, node.parentId, parentByNode)) {
      parentByNode.set(node.id, node.parentId);
      continue;
    }

    const inferred = (incomingPrerequisites.get(node.id) ?? []).find(
      (candidate) => nodeIds.has(candidate) && !wouldCreateCycle(node.id, candidate, parentByNode)
    );
    parentByNode.set(node.id, inferred ?? null);
  }

  return parentByNode;
}

function wouldCreateCycle(nodeId: string, parentId: string, parentByNode: Map<string, string | null>) {
  let current: string | null | undefined = parentId;
  while (current) {
    if (current === nodeId) return true;
    current = parentByNode.get(current);
  }
  return false;
}

function buildEdgesFromNodeNotes(treeId: string, parsedNotes: ParsedNodeNote[]): SkillEdgeData[] {
  const edges = new Map<string, SkillEdgeData>();
  const nodeIds = new Set(parsedNotes.map((note) => note.node.id));

  for (const note of parsedNotes) {
    for (const type of ["prerequisite", "recommended", "optional"] as const) {
      for (const sourceNodeId of note.dependencies[type]) {
        if (!nodeIds.has(sourceNodeId)) continue;
        const key = `${sourceNodeId}->${note.node.id}:${type}`;
        edges.set(key, {
          id: `edge-${stableHash(key).slice(0, 16)}`,
          treeId,
          sourceNodeId,
          targetNodeId: note.node.id,
          type,
          style: null,
        });
      }
    }
  }

  return [...edges.values()];
}

function getNodeDependencies(edges: SkillEdgeData[], nodeId: string): Record<EdgeType, string[]> {
  return {
    prerequisite: edges.filter((edge) => edge.targetNodeId === nodeId && edge.type === "prerequisite").map((edge) => edge.sourceNodeId),
    recommended: edges.filter((edge) => edge.targetNodeId === nodeId && edge.type === "recommended").map((edge) => edge.sourceNodeId),
    optional: edges.filter((edge) => edge.targetNodeId === nodeId && edge.type === "optional").map((edge) => edge.sourceNodeId),
  };
}

async function readManifestAtPath(vaultPath: string, relativePath: string): Promise<ObsidianTreeManifest> {
  const raw = await readVaultFile(vaultPath, relativePath);
  return JSON.parse(raw) as ObsidianTreeManifest;
}

async function findManifestPathForTree(vaultPath: string, rootFolder: string, treeId: string) {
  const rootPath = toAbsoluteVaultPath(vaultPath, rootFolder);
  const manifests = await findFiles(rootPath, MANIFEST_FILE_NAME).catch(() => []);

  for (const absolutePath of manifests) {
    const relativePath = toVaultRelativePath(vaultPath, absolutePath);
    const manifest = await readManifestAtPath(vaultPath, relativePath).catch(() => null);
    if (manifest?.obsidian?.appTreeId === treeId) return relativePath;
  }

  return null;
}

async function collectNodeNotePaths(vaultPath: string, treeRoot: string, manifest: ObsidianTreeManifest) {
  const paths = new Set(Object.values(manifest.obsidian?.nodePaths ?? {}));
  const markdownFiles = await findFiles(toAbsoluteVaultPath(vaultPath, treeRoot), ".md", true).catch(() => []);

  for (const absolutePath of markdownFiles) {
    const relativePath = toVaultRelativePath(vaultPath, absolutePath);
    if (relativePath.endsWith(`/${TREE_NOTE_FILE_NAME}`)) continue;
    paths.add(relativePath);
  }

  return [...paths].sort();
}

async function deleteStaleNodeNotes(vaultPath: string, previousPaths: Record<string, string>, nextPaths: Record<string, string>) {
  const nextPathSet = new Set(Object.values(nextPaths));
  for (const previousPath of Object.values(previousPaths)) {
    if (nextPathSet.has(previousPath)) continue;
    const existing = await readVaultFile(vaultPath, previousPath).catch(() => null);
    if (!existing || !existing.includes("skilltreeKind: \"node\"")) continue;
    await fs.rm(toAbsoluteVaultPath(vaultPath, previousPath), { force: true });
  }
}

async function findFiles(rootPath: string, needle: string, byExtension = false): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findFiles(absolutePath, needle, byExtension));
    } else if (entry.isFile() && (byExtension ? entry.name.endsWith(needle) : entry.name === needle)) {
      results.push(absolutePath);
    }
  }

  return results;
}

async function ensureVaultDir(vaultPath: string, relativePath: string) {
  await fs.mkdir(toAbsoluteVaultPath(vaultPath, relativePath), { recursive: true });
}

async function writeVaultFile(vaultPath: string, relativePath: string, content: string) {
  await fs.mkdir(path.dirname(toAbsoluteVaultPath(vaultPath, relativePath)), { recursive: true });
  await fs.writeFile(toAbsoluteVaultPath(vaultPath, relativePath), content, "utf8");
}

async function readVaultFile(vaultPath: string, relativePath: string) {
  return fs.readFile(toAbsoluteVaultPath(vaultPath, relativePath), "utf8");
}

function toAbsoluteVaultPath(vaultPath: string, relativePath: string) {
  return path.join(vaultPath, ...relativePath.split("/"));
}

function toVaultRelativePath(vaultPath: string, absolutePath: string) {
  return path.relative(vaultPath, absolutePath).split(path.sep).join("/");
}

function parseMarkdownDocument(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: {}, body: normalized };

  const endIndex = normalized.indexOf("\n---", 4);
  if (endIndex === -1) return { frontmatter: {}, body: normalized };

  const frontmatterText = normalized.slice(4, endIndex).trim();
  const body = normalized.slice(endIndex + 4).replace(/^\n/, "");
  return {
    frontmatter: parseFrontmatter(frontmatterText),
    body,
  };
}

function parseFrontmatter(frontmatterText: string): Frontmatter {
  const result: Frontmatter = {};
  for (const line of frontmatterText.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    result[key] = parseFrontmatterValue(value);
  }
  return result;
}

function parseFrontmatterValue(raw: string): unknown {
  if (raw === "null" || raw === "~" || raw === "") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("[") || raw.startsWith("{") || raw.startsWith("\"")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.replace(/^"|"$/g, "");
    }
  }
  return raw;
}

function readNodeIdFromMarkdown(markdown: string) {
  return asString(parseMarkdownDocument(markdown).frontmatter.nodeId);
}

function readFirstHeading(body: string) {
  return body.split("\n").find((line) => line.startsWith("# "))?.replace(/^#\s+/, "").trim() || null;
}

function readBodyBeforeSections(body: string) {
  return body
    .replace(/^# .*\n+/, "")
    .split(/\n##\s+/)[0]
    .trim() || null;
}

function readSection(body: string, sectionTitle: string) {
  const pattern = new RegExp(`(^|\\n)##\\s+${escapeRegex(sectionTitle)}\\s*\\n`, "i");
  const match = pattern.exec(body);
  if (!match) return null;
  const start = (match.index ?? 0) + match[0].length;
  const rest = body.slice(start);
  const next = rest.search(/\n##\s+/);
  return (next >= 0 ? rest.slice(0, next) : rest).trim();
}

function parseSubtasks(section: string | null): SubTask[] | null {
  if (section === null) return null;
  return section
    .split("\n")
    .map((line) => /^-\s+\[([ xX])\]\s+(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ done: match[1].toLowerCase() === "x", title: match[2].trim() }));
}

function parseResources(section: string | null): Resource[] | null {
  if (section === null) return null;
  return section
    .split("\n")
    .map((line) => /^-\s+\[(.+?)\]\((.+?)\)/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ title: match[1].trim(), url: match[2].trim() }));
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function parseJsonishObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  return asString(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  return asNumber(value);
}

function normalizeStatus(value: string | null | undefined): SkillNodeData["status"] {
  if (value === "locked" || value === "available" || value === "in_progress" || value === "completed") return value;
  return "available";
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function progressFromSubtasks(subTasks: SubTask[]) {
  if (subTasks.length === 0) return 0;
  return Math.round((subTasks.filter((task) => task.done).length / subTasks.length) * 100);
}

function compareNodesForPath(a: SkillNodeData, b: SkillNodeData) {
  return a.positionY - b.positionY || a.positionX - b.positionX || a.title.localeCompare(b.title);
}

function slugifyPathSegment(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || fallback.replace(/[^a-zA-Z0-9_-]+/g, "-") || "skill";
}

function stableHash(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
