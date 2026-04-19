import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath,
} from "obsidian";
import { spawn } from "child_process";

const VIEW_TYPE_SKILLTREE = "skilltree-control-view";
const MANIFEST_FILE_NAME = "_skilltree.json";
const TREE_NOTE_FILE_NAME = "tree.md";

type NodeStatus = "locked" | "available" | "in_progress" | "completed";
type EdgeType = "prerequisite" | "recommended" | "optional";
type ShareMode = "private" | "public_readonly" | "public_edit";

interface SubTask {
  title: string;
  done: boolean;
}

interface Resource {
  title: string;
  url: string;
}

interface SkillNodeData {
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

interface SkillEdgeData {
  id: string;
  treeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  style: Record<string, unknown> | null;
}

interface SkillTreeData {
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

interface SkillTreeSettings {
  rootFolder: string;
  desktopAppPath: string;
}

interface TreeManifest {
  version: 1;
  format: "backup";
  tree: {
    title: string;
    description: string | null;
    theme: string;
    canvasState: Record<string, unknown> | null;
    slug: string;
    isPublic: boolean;
    shareMode: ShareMode;
  };
  nodes: Array<Omit<SkillNodeData, "treeId">>;
  edges: Array<Omit<SkillEdgeData, "treeId">>;
  obsidian: {
    appTreeId: string;
    appUserId: string;
    rootFolder: string;
    treeNotePath: string;
    nodePaths: Record<string, string>;
    generatedAt: string;
  };
}

interface ParsedNodeNote {
  node: SkillNodeData;
  dependencies: Record<EdgeType, string[]>;
  hasDependencyMetadata: boolean;
}

const DEFAULT_SETTINGS: SkillTreeSettings = {
  rootFolder: "SkillTree",
  desktopAppPath: "skilltree-local",
};

export default class SkillTreePlugin extends Plugin {
  settings: SkillTreeSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_SKILLTREE,
      (leaf) => new SkillTreeView(leaf, this)
    );

    this.addRibbonIcon("network", "SkillTree Control", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-skilltree-control",
      name: "Open SkillTree Control",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "create-skilltree",
      name: "Create SkillTree",
      callback: async () => {
        const tree = await this.createTreeFromPrompt();
        if (tree) await this.activateView(tree.id);
      },
    });

    this.addSettingTab(new SkillTreeSettingTab(this.app, this));
  }

  async activateView(treeId?: string) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SKILLTREE);
    const leaf = leaves[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({
      type: VIEW_TYPE_SKILLTREE,
      active: true,
      state: treeId ? { treeId } : undefined,
    });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  launchDesktopApp() {
    const vaultBasePath = (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.();
    const child = spawn(this.settings.desktopAppPath || DEFAULT_SETTINGS.desktopAppPath, [], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        ...(vaultBasePath ? { OBSIDIAN_VAULT_PATH: vaultBasePath } : {}),
        SKILLTREE_OBSIDIAN_ROOT: this.settings.rootFolder || DEFAULT_SETTINGS.rootFolder,
      },
    });
    child.on("error", (error) => {
      new Notice(`Could not launch SkillTree Local: ${error.message}`);
    });
    child.unref();
    new Notice("Opening SkillTree Local");
  }

  async loadTrees(): Promise<SkillTreeData[]> {
    await this.ensureFolder(this.settings.rootFolder);
    const manifests = this.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(`${this.settings.rootFolder}/`) && file.name === MANIFEST_FILE_NAME);

    const trees: SkillTreeData[] = [];
    for (const manifest of manifests) {
      try {
        trees.push(await this.readTreeFromManifest(manifest));
      } catch (error) {
        console.error("Failed to load SkillTree manifest", manifest.path, error);
      }
    }

    return trees.sort((a, b) => a.title.localeCompare(b.title));
  }

  async createTreeFromPrompt() {
    const title = await promptForText(this.app, "New SkillTree", "Tree title");
    if (!title) return null;

    const treeId = `obsidian-${Date.now().toString(36)}`;
    const tree: SkillTreeData = {
      id: treeId,
      userId: "obsidian-local",
      title,
      description: null,
      slug: `${slugifyPathSegment(title, "skill-tree")}-${treeId.slice(-5)}`,
      isPublic: false,
      shareMode: "private",
      theme: "rpg-dark",
      canvasState: null,
      nodes: [],
      edges: [],
    };

    await this.writeTree(tree);
    new Notice(`Created ${title}`);
    return tree;
  }

  async createNode(tree: SkillTreeData, parentId: string | null) {
    const title = await promptForText(this.app, "New Skill Node", "Node title");
    if (!title) return tree;

    const siblingCount = tree.nodes.filter((node) => node.parentId === parentId).length;
    const parent = parentId ? tree.nodes.find((node) => node.id === parentId) : null;
    const node: SkillNodeData = {
      id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      treeId: tree.id,
      parentId,
      title,
      description: null,
      difficulty: 1,
      estimatedHours: null,
      progress: 0,
      status: parentId ? "locked" : "available",
      positionX: parent ? parent.positionX + 220 : siblingCount * 220,
      positionY: parent ? parent.positionY + 140 + siblingCount * 40 : 0,
      style: null,
      subTasks: [],
      resources: [],
      notes: null,
      subTreeId: null,
    };

    const nextTree = {
      ...tree,
      nodes: [...tree.nodes, node],
      edges: parentId
        ? [
            ...tree.edges,
            {
              id: `edge-${stableHash(`${parentId}->${node.id}:prerequisite`).slice(0, 16)}`,
              treeId: tree.id,
              sourceNodeId: parentId,
              targetNodeId: node.id,
              type: "prerequisite" as EdgeType,
              style: null,
            },
          ]
        : tree.edges,
    };

    await this.writeTree(nextTree);
    return nextTree;
  }

  async updateNode(tree: SkillTreeData, updatedNode: SkillNodeData) {
    const nextTree = {
      ...tree,
      nodes: tree.nodes.map((node) => (node.id === updatedNode.id ? updatedNode : node)),
    };
    await this.writeTree(nextTree);
    return nextTree;
  }

  async writeTree(tree: SkillTreeData) {
    const rootFolder = this.settings.rootFolder || DEFAULT_SETTINGS.rootFolder;
    const treeFolder = normalizePath(`${rootFolder}/${slugifyPathSegment(tree.slug || tree.title, tree.id)}`);
    const treeNotePath = normalizePath(`${treeFolder}/${TREE_NOTE_FILE_NAME}`);
    const manifestPath = normalizePath(`${treeFolder}/${MANIFEST_FILE_NAME}`);
    const nodePaths = buildNodePaths(tree, treeFolder);

    await this.ensureFolder(treeFolder);
    await this.writeFile(treeNotePath, renderTreeNote(tree));

    for (const node of tree.nodes) {
      const nodePath = nodePaths[node.id];
      if (!nodePath) continue;
      await this.ensureFolder(parentPath(nodePath));
      await this.writeFile(nodePath, renderNodeNote(tree, node));
    }

    const manifest = buildManifest(tree, rootFolder, treeNotePath, nodePaths);
    await this.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  async readTreeFromManifest(file: TFile): Promise<SkillTreeData> {
    const raw = await this.app.vault.read(file);
    const manifest = JSON.parse(raw) as TreeManifest;
    const treeId = manifest.obsidian?.appTreeId || `obsidian-${stableHash(file.path).slice(0, 12)}`;
    const treeRoot = parentPath(file.path);

    let tree: SkillTreeData = {
      id: treeId,
      userId: manifest.obsidian?.appUserId || "obsidian-local",
      title: manifest.tree.title,
      description: manifest.tree.description,
      slug: manifest.tree.slug,
      isPublic: manifest.tree.isPublic,
      shareMode: manifest.tree.shareMode,
      theme: manifest.tree.theme,
      canvasState: manifest.tree.canvasState,
      nodes: manifest.nodes.map((node) => ({ ...node, treeId })),
      edges: manifest.edges.map((edge) => ({ ...edge, treeId })),
    };

    const treeNotePath = manifest.obsidian?.treeNotePath || normalizePath(`${treeRoot}/${TREE_NOTE_FILE_NAME}`);
    const treeNoteFile = this.getFile(treeNotePath);
    if (treeNoteFile) {
      tree = applyTreeNote(tree, await this.app.vault.read(treeNoteFile));
    }

    const nodePaths = new Set(Object.values(manifest.obsidian?.nodePaths ?? {}));
    for (const markdownFile of this.app.vault.getMarkdownFiles()) {
      if (!markdownFile.path.startsWith(`${treeRoot}/`) || markdownFile.path === treeNotePath) continue;
      nodePaths.add(markdownFile.path);
    }

    const nodesById = new Map(tree.nodes.map((node) => [node.id, node]));
    const parsedNotes: ParsedNodeNote[] = [];
    for (const nodePath of [...nodePaths].sort()) {
      const nodeFile = this.getFile(nodePath);
      if (!nodeFile) continue;
      const markdown = await this.app.vault.read(nodeFile);
      const parsed = parseNodeNote(markdown, nodesById.get(readNodeIdFromMarkdown(markdown) ?? ""), treeId);
      if (!parsed) continue;
      nodesById.set(parsed.node.id, parsed.node);
      parsedNotes.push(parsed);
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
      tree = { ...tree, edges: buildEdgesFromNodeNotes(tree.id, parsedNotes) };
    }

    return tree;
  }

  async rewriteTreeFromNotes(tree: SkillTreeData) {
    await this.writeTree(tree);
    new Notice("SkillTree notes and manifest are in sync");
  }

  async openNodeNote(tree: SkillTreeData, nodeId: string) {
    const nodePaths = buildNodePaths(tree, normalizePath(`${this.settings.rootFolder}/${slugifyPathSegment(tree.slug || tree.title, tree.id)}`));
    const nodePath = nodePaths[nodeId];
    if (!nodePath) return;

    const file = this.getFile(nodePath);
    if (!file) {
      await this.writeTree(tree);
    }

    const nextFile = this.getFile(nodePath);
    if (nextFile) {
      await this.app.workspace.getLeaf(true).openFile(nextFile);
    }
  }

  async ensureFolder(folderPath: string) {
    const normalized = normalizePath(folderPath);
    if (!normalized || normalized === "/") return;

    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`${current} exists and is not a folder`);
      await this.app.vault.createFolder(current);
    }
  }

  async writeFile(filePath: string, content: string) {
    const existing = this.getFile(filePath);
    if (existing) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  getFile(filePath: string) {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
    return file instanceof TFile ? file : null;
  }
}

class SkillTreeView extends ItemView {
  plugin: SkillTreePlugin;
  trees: SkillTreeData[] = [];
  selectedTreeId: string | null = null;
  selectedNodeId: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: SkillTreePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_SKILLTREE;
  }

  getDisplayText() {
    return "SkillTree Control";
  }

  getIcon() {
    return "network";
  }

  async onOpen() {
    const state = this.leaf.getViewState().state as { treeId?: string } | undefined;
    this.selectedTreeId = state?.treeId ?? null;
    await this.reload();
  }

  async reload() {
    this.trees = await this.plugin.loadTrees();
    if (!this.selectedTreeId && this.trees[0]) this.selectedTreeId = this.trees[0].id;
    if (this.selectedTreeId && !this.trees.some((tree) => tree.id === this.selectedTreeId)) {
      this.selectedTreeId = this.trees[0]?.id ?? null;
      this.selectedNodeId = null;
    }
    this.render();
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("skilltree-control-view");

    const header = container.createDiv({ cls: "skilltree-control-header" });
    header.createEl("h2", { text: "SkillTree" });
    header.createEl("p", { text: `Vault folder: ${this.plugin.settings.rootFolder}` });

    const toolbar = container.createDiv({ cls: "skilltree-control-toolbar" });
    toolbar.createEl("button", { text: "Refresh" }).onclick = () => void this.reload();
    toolbar.createEl("button", { text: "New tree" }).onclick = async () => {
      const tree = await this.plugin.createTreeFromPrompt();
      if (!tree) return;
      this.selectedTreeId = tree.id;
      this.selectedNodeId = null;
      await this.reload();
    };

    const selectedTree = this.trees.find((tree) => tree.id === this.selectedTreeId) ?? null;
    toolbar.createEl("button", { text: "Open desktop app" }).onclick = () => {
      this.plugin.launchDesktopApp();
    };

    if (this.trees.length === 0) {
      container.createDiv({ cls: "skilltree-control-empty", text: "No SkillTree mirrors found. Create one here or use the desktop app with this vault folder." });
      return;
    }

    const treeSelect = container.createEl("select", { cls: "skilltree-control-select" });
    for (const tree of this.trees) {
      treeSelect.createEl("option", { text: tree.title, value: tree.id });
    }
    treeSelect.value = selectedTree?.id ?? "";
    treeSelect.onchange = () => {
      this.selectedTreeId = treeSelect.value;
      this.selectedNodeId = null;
      this.render();
    };

    if (!selectedTree) return;

    const treeActions = container.createDiv({ cls: "skilltree-control-actions" });
    treeActions.createEl("button", { text: "Add root node" }).onclick = async () => {
      const nextTree = await this.plugin.createNode(selectedTree, null);
      this.selectedTreeId = nextTree.id;
      this.selectedNodeId = nextTree.nodes.at(-1)?.id ?? null;
      await this.reload();
    };
    treeActions.createEl("button", { text: "Write notes" }).onclick = async () => {
      await this.plugin.rewriteTreeFromNotes(selectedTree);
      await this.reload();
    };
    treeActions.createEl("button", { text: "Rebuild from notes" }).onclick = async () => {
      const manifest = this.app.vault
        .getFiles()
        .find((file) => file.name === MANIFEST_FILE_NAME && file.path.includes(`/${slugifyPathSegment(selectedTree.slug || selectedTree.title, selectedTree.id)}/`));
      if (manifest) {
        const rebuilt = await this.plugin.readTreeFromManifest(manifest);
        await this.plugin.writeTree(rebuilt);
        await this.reload();
      }
    };

    const layout = container.createDiv({ cls: "skilltree-control-layout" });
    const list = layout.createDiv({ cls: "skilltree-control-list" });
    const detail = layout.createDiv({ cls: "skilltree-control-detail" });

    renderNodeTree(list, selectedTree, this.selectedNodeId, (nodeId) => {
      this.selectedNodeId = nodeId;
      this.render();
    });

    const selectedNode = selectedTree.nodes.find((node) => node.id === this.selectedNodeId) ?? selectedTree.nodes[0] ?? null;
    if (selectedNode && !this.selectedNodeId) this.selectedNodeId = selectedNode.id;
    this.renderNodeDetail(detail, selectedTree, selectedNode);
  }

  renderNodeDetail(container: HTMLElement, tree: SkillTreeData, node: SkillNodeData | null) {
    container.empty();
    if (!node) {
      container.createDiv({ cls: "skilltree-control-empty", text: "Select a node to edit it." });
      return;
    }

    container.createEl("h3", { text: node.title });
    container.createEl("p", { cls: "skilltree-control-muted", text: node.description || "No description yet." });

    new Setting(container)
      .setName("Status")
      .addDropdown((dropdown) => {
        for (const status of ["locked", "available", "in_progress", "completed"] as NodeStatus[]) {
          dropdown.addOption(status, status.replace("_", " "));
        }
        dropdown.setValue(node.status);
        dropdown.onChange(async (value) => {
          const updated = { ...node, status: value as NodeStatus };
          const nextTree = await this.plugin.updateNode(tree, updated);
          this.trees = this.trees.map((entry) => (entry.id === tree.id ? nextTree : entry));
          this.render();
        });
      });

    new Setting(container)
      .setName("Progress")
      .setDesc(`${node.progress}%`)
      .addSlider((slider) => {
        slider.setLimits(0, 100, 5);
        slider.setValue(node.progress);
        slider.onChange(async (value) => {
          const updated = {
            ...node,
            progress: value,
            status: value >= 100 ? "completed" as NodeStatus : value > 0 ? "in_progress" as NodeStatus : node.status,
          };
          const nextTree = await this.plugin.updateNode(tree, updated);
          this.trees = this.trees.map((entry) => (entry.id === tree.id ? nextTree : entry));
          this.render();
        });
      });

    const actions = container.createDiv({ cls: "skilltree-control-actions" });
    actions.createEl("button", { text: "Open note" }).onclick = () => {
      void this.plugin.openNodeNote(tree, node.id);
    };
    actions.createEl("button", { text: "Add child" }).onclick = async () => {
      const nextTree = await this.plugin.createNode(tree, node.id);
      this.selectedNodeId = nextTree.nodes.at(-1)?.id ?? node.id;
      await this.reload();
    };
    actions.createEl("button", { text: "Add peer" }).onclick = async () => {
      const nextTree = await this.plugin.createNode(tree, node.parentId);
      this.selectedNodeId = nextTree.nodes.at(-1)?.id ?? node.id;
      await this.reload();
    };

    container.createEl("h4", { text: "Subtasks" });
    if (node.subTasks.length === 0) {
      container.createDiv({ cls: "skilltree-control-muted", text: "No subtasks." });
    }
    node.subTasks.forEach((task, index) => {
      const row = container.createDiv({ cls: "skilltree-control-task" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = task.done;
      checkbox.onchange = async () => {
        const subTasks = node.subTasks.map((entry, taskIndex) =>
          taskIndex === index ? { ...entry, done: checkbox.checked } : entry
        );
        const progress = subTasks.length > 0
          ? Math.round((subTasks.filter((entry) => entry.done).length / subTasks.length) * 100)
          : node.progress;
        const nextTree = await this.plugin.updateNode(tree, {
          ...node,
          subTasks,
          progress,
          status: progress >= 100 ? "completed" : progress > 0 ? "in_progress" : node.status,
        });
        this.trees = this.trees.map((entry) => (entry.id === tree.id ? nextTree : entry));
        this.render();
      };
      row.createSpan({ text: task.title });
    });

    container.createEl("h4", { text: "Dependencies" });
    const dependencyLines = tree.edges
      .filter((edge) => edge.targetNodeId === node.id)
      .map((edge) => {
        const source = tree.nodes.find((entry) => entry.id === edge.sourceNodeId);
        return `${edge.type}: ${source?.title ?? edge.sourceNodeId}`;
      });
    container.createDiv({
      cls: "skilltree-control-muted",
      text: dependencyLines.length > 0 ? dependencyLines.join("\n") : "No dependencies.",
    });
  }
}

class SkillTreeSettingTab extends PluginSettingTab {
  plugin: SkillTreePlugin;

  constructor(app: App, plugin: SkillTreePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SkillTree Control" });

    new Setting(containerEl)
      .setName("Root folder")
      .setDesc("Folder used for SkillTree mirrors inside this vault.")
      .addText((text) => {
        text.setPlaceholder("SkillTree");
        text.setValue(this.plugin.settings.rootFolder);
        text.onChange(async (value) => {
          this.plugin.settings.rootFolder = normalizePath(value.trim() || DEFAULT_SETTINGS.rootFolder);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Desktop app path")
      .setDesc("Command or absolute path used by the Open desktop app button.")
      .addText((text) => {
        text.setPlaceholder("skilltree-local");
        text.setValue(this.plugin.settings.desktopAppPath);
        text.onChange(async (value) => {
          this.plugin.settings.desktopAppPath = value.trim() || DEFAULT_SETTINGS.desktopAppPath;
          await this.plugin.saveSettings();
        });
      });
  }
}

class TextPromptModal extends Modal {
  title: string;
  placeholder: string;
  value = "";
  resolve: (value: string | null) => void;

  constructor(app: App, title: string, placeholder: string, resolve: (value: string | null) => void) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.resolve = resolve;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });
    new Setting(contentEl).addText((text) => {
      text.setPlaceholder(this.placeholder);
      text.inputEl.focus();
      text.onChange((value) => {
        this.value = value;
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.submit();
        }
      });
    });
    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Cancel").onClick(() => this.close());
      })
      .addButton((button) => {
        button.setCta();
        button.setButtonText("Create").onClick(() => this.submit());
      });
  }

  onClose() {
    this.contentEl.empty();
    this.resolve(null);
  }

  submit() {
    const value = this.value.trim();
    if (!value) return;
    this.resolve(value);
    this.resolve = () => undefined;
    this.close();
  }
}

function promptForText(app: App, title: string, placeholder: string) {
  return new Promise<string | null>((resolve) => {
    new TextPromptModal(app, title, placeholder, resolve).open();
  });
}

function renderNodeTree(container: HTMLElement, tree: SkillTreeData, selectedNodeId: string | null, onSelect: (nodeId: string) => void) {
  container.empty();
  container.createEl("h3", { text: tree.title });
  if (tree.description) container.createEl("p", { cls: "skilltree-control-muted", text: tree.description });

  const parentByNode = buildFolderParentMap(tree);
  const children = new Map<string | null, SkillNodeData[]>();
  for (const node of tree.nodes) {
    const parentId = parentByNode.get(node.id) ?? null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(node);
    children.set(parentId, siblings);
  }
  for (const siblings of children.values()) siblings.sort(compareNodesForPath);

  const renderBranch = (parentId: string | null, host: HTMLElement, depth: number) => {
    for (const node of children.get(parentId) ?? []) {
      const button = host.createEl("button", {
        cls: `skilltree-control-node ${node.id === selectedNodeId ? "is-selected" : ""}`,
      });
      button.style.paddingLeft = `${8 + depth * 14}px`;
      button.createSpan({ cls: `skilltree-status-dot status-${node.status}` });
      button.createSpan({ text: node.title });
      button.onclick = () => onSelect(node.id);
      renderBranch(node.id, host, depth + 1);
    }
  };

  renderBranch(null, container, 0);
}

function buildManifest(tree: SkillTreeData, rootFolder: string, treeNotePath: string, nodePaths: Record<string, string>): TreeManifest {
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
      shareMode: tree.shareMode,
    },
    nodes: tree.nodes.map(({ treeId, ...node }) => {
      void treeId;
      return node;
    }),
    edges: tree.edges.map(({ treeId, ...edge }) => {
      void treeId;
      return edge;
    }),
    obsidian: {
      appTreeId: tree.id,
      appUserId: tree.userId,
      rootFolder,
      treeNotePath,
      nodePaths,
      generatedAt: new Date().toISOString(),
    },
  };
}

function renderTreeNote(tree: SkillTreeData) {
  return [
    renderFrontmatter({
      skilltreeKind: "tree",
      treeId: tree.id,
      title: tree.title,
      slug: tree.slug,
      theme: tree.theme,
      shareMode: tree.shareMode,
      isPublic: tree.isPublic,
      canvasStateJson: tree.canvasState,
    }),
    `# ${tree.title}`,
    "",
    tree.description?.trim() || "",
    "",
  ].join("\n");
}

function renderNodeNote(tree: SkillTreeData, node: SkillNodeData) {
  const dependencies = getNodeDependencies(tree.edges, node.id);
  return [
    renderFrontmatter({
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
    }),
    `# ${node.title}`,
    "",
    node.description?.trim() || "",
    "",
    "## Subtasks",
    "",
    ...(node.subTasks.length > 0 ? node.subTasks.map((task) => `- [${task.done ? "x" : " "}] ${task.title}`) : [""]),
    "",
    "## Notes",
    "",
    node.notes?.trim() || "",
    "",
    "## Resources",
    "",
    ...(node.resources.length > 0 ? node.resources.map((resource) => `- [${resource.title}](${resource.url})`) : [""]),
    "",
  ].join("\n");
}

function renderFrontmatter(values: Record<string, unknown>) {
  return ["---", ...Object.entries(values).map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`), "---", ""].join("\n");
}

function formatFrontmatterValue(value: unknown) {
  if (value === null || typeof value === "undefined") return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function applyTreeNote(tree: SkillTreeData, markdown: string): SkillTreeData {
  const { frontmatter, body } = parseMarkdownDocument(markdown);
  return {
    ...tree,
    title: asString(frontmatter.title) || readFirstHeading(body) || tree.title,
    description: readBodyBeforeSections(body) || tree.description,
    theme: asString(frontmatter.theme) || tree.theme,
    canvasState: parseJsonishObject(frontmatter.canvasStateJson) ?? tree.canvasState,
  };
}

function parseNodeNote(markdown: string, existingNode: SkillNodeData | undefined, treeId: string): ParsedNodeNote | null {
  const { frontmatter, body } = parseMarkdownDocument(markdown);
  if (frontmatter.skilltreeKind !== "node" && frontmatter.skilltree_kind !== "node") return null;

  const nodeId = asString(frontmatter.nodeId) || existingNode?.id || `obsidian-${stableHash(markdown).slice(0, 12)}`;
  const subTasks = parseSubtasks(readSection(body, "Subtasks")) ?? existingNode?.subTasks ?? [];
  const resources = parseResources(readSection(body, "Resources")) ?? existingNode?.resources ?? [];
  const dependencies = {
    prerequisite: parseStringArray(frontmatter.requires),
    recommended: parseStringArray(frontmatter.recommended),
    optional: parseStringArray(frontmatter.optional),
  };

  return {
    node: {
      id: nodeId,
      treeId,
      parentId: asNullableString(frontmatter.parentId) ?? existingNode?.parentId ?? null,
      title: asString(frontmatter.title) || readFirstHeading(body) || existingNode?.title || "Untitled Skill",
      description: readBodyBeforeSections(body) || existingNode?.description || null,
      difficulty: asNumber(frontmatter.difficulty) ?? existingNode?.difficulty ?? 1,
      estimatedHours: asNullableNumber(frontmatter.estimatedHours) ?? existingNode?.estimatedHours ?? null,
      progress: clampProgress(asNumber(frontmatter.progress) ?? existingNode?.progress ?? progressFromSubtasks(subTasks)),
      status: normalizeStatus(asString(frontmatter.status) || existingNode?.status),
      positionX: asNumber(frontmatter.positionX) ?? existingNode?.positionX ?? 0,
      positionY: asNumber(frontmatter.positionY) ?? existingNode?.positionY ?? 0,
      style: parseJsonishObject(frontmatter.styleJson) ?? existingNode?.style ?? null,
      subTasks,
      resources,
      notes: readSection(body, "Notes")?.trim() || existingNode?.notes || null,
      subTreeId: asNullableString(frontmatter.subTreeId) ?? existingNode?.subTreeId ?? null,
    },
    dependencies,
    hasDependencyMetadata: "requires" in frontmatter || "recommended" in frontmatter || "optional" in frontmatter,
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

  for (const siblings of childrenByParent.values()) siblings.sort(compareNodesForPath);

  const segmentByNode = new Map<string, string>();
  for (const siblings of childrenByParent.values()) {
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
    nodePaths[node.id] = normalizePath(`${treeFolder}/${[...resolveFolderParts(node.id), `${segment}.md`].join("/")}`);
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

function parseMarkdownDocument(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: {} as Record<string, unknown>, body: normalized };
  const endIndex = normalized.indexOf("\n---", 4);
  if (endIndex === -1) return { frontmatter: {} as Record<string, unknown>, body: normalized };
  return {
    frontmatter: parseFrontmatter(normalized.slice(4, endIndex).trim()),
    body: normalized.slice(endIndex + 4).replace(/^\n/, ""),
  };
}

function parseFrontmatter(frontmatterText: string) {
  const result: Record<string, unknown> = {};
  for (const line of frontmatterText.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    result[line.slice(0, separator).trim()] = parseFrontmatterValue(line.slice(separator + 1).trim());
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
  return body.replace(/^# .*\n+/, "").split(/\n##\s+/)[0].trim() || null;
}

function readSection(body: string, sectionTitle: string) {
  const pattern = new RegExp(`(^|\\n)##\\s+${escapeRegex(sectionTitle)}\\s*\\n`, "i");
  const match = pattern.exec(body);
  if (!match) return null;
  const rest = body.slice((match.index ?? 0) + match[0].length);
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

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableString(value: unknown) {
  if (value === null || typeof value === "undefined") return null;
  return asString(value);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableNumber(value: unknown) {
  if (value === null || typeof value === "undefined") return null;
  return asNumber(value);
}

function normalizeStatus(value: string | null | undefined): NodeStatus {
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

function parentPath(filePath: string) {
  return filePath.split("/").slice(0, -1).join("/");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
