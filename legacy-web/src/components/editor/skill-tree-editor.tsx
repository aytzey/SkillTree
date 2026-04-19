"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "./skill-node";
import { SkillEdge } from "./skill-edge";
import { WorldHeader } from "./world-header";
import { InspectorPanel } from "./inspector-panel";
import { JourneyStatusBar } from "./journey-status-bar";
import { ContextMenu } from "./context-menu";
import { computeNodeStatuses } from "@/lib/status-engine";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import {
  applyNodeUpdateWithStatuses,
  findAvailableNodePosition,
  mergeNodeUpdates,
} from "@/lib/tree-editor-utils";
import {
  buildBackupTreeExport,
  buildPortableTreeExport,
} from "@/lib/tree-portability";
import { EDIT_TOKEN_HEADER } from "@/lib/tree-share-constants";
import type {
  SkillTreeData,
  SkillNodeData,
  NodeStatus,
  ShareMode,
  EdgeType,
} from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

const CANVAS_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${(i * 8.3 + 5) % 100}%`,
  bottom: `${(i * 13 + 10) % 40}%`,
  delay: `${i * 1.1}s`,
  size: i % 3 === 0 ? 1.5 : 2,
}));

function CanvasParticles() {
  return (
    <div className="poe-canvas-particles">
      {CANVAS_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="poe-canvas-particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            animationDelay: p.delay,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  );
}

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";
type ImportMode = "new" | "replace";
type ObsidianSyncState = "idle" | "syncing" | "failed";

interface EditorProps {
  tree: SkillTreeData;
  canEdit?: boolean;
  canManageShare?: boolean;
  sharedEditToken?: string | null;
  initialReadOnly?: boolean;
}

function toFlowNodes(nodes: SkillNodeData[], selectedId: string | null): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "skillNode",
    position: { x: node.positionX, y: node.positionY },
    data: {
      title: node.title,
      status: node.status,
      difficulty: node.difficulty,
      progress: node.progress,
      description: node.description,
      selected: node.id === selectedId,
    },
  }));
}

function toFlowEdges(edges: SkillTreeData["edges"]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: "skillEdge",
    data: { type: edge.type },
  }));
}

function createDownloadFileName(title: string, suffix: "portable" | "backup") {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "skill-tree";
  return `${slug}.${suffix}.json`;
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function EditorInner({
  tree,
  canEdit = true,
  canManageShare = true,
  sharedEditToken = null,
  initialReadOnly,
}: EditorProps) {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(
    toFlowNodes(tree.nodes, null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(tree.edges)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>(tree.shareMode);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(
    initialReadOnly ?? !canEdit
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [obsidianSyncState, setObsidianSyncState] =
    useState<ObsidianSyncState>("idle");
  const [obsidianFeedback, setObsidianFeedback] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [pickMode, setPickMode] = useState<{
    direction: "above" | "below";
    anchorNodeId: string;
  } | null>(null);
  const [pickEdgeTypePopup, setPickEdgeTypePopup] = useState<{
    direction: "above" | "below";
    anchorNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const treeDataRef = useRef<SkillTreeData>({ ...tree, shareMode: tree.shareMode });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importModeRef = useRef<ImportMode>("new");
  const { fitView } = useReactFlow();

  const effectiveCanEdit = canEdit && !isReadOnly;
  const selectedNode = selectedNodeId
    ? treeDataRef.current.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  useEffect(() => {
    treeDataRef.current = {
      ...treeDataRef.current,
      shareMode,
      isPublic: shareMode !== "private",
    };
  }, [shareMode]);

  useEffect(() => {
    if (!shareFeedback) return undefined;

    const timer = window.setTimeout(() => {
      setShareFeedback(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  useEffect(() => {
    if (!obsidianFeedback) return undefined;

    const timer = window.setTimeout(() => {
      setObsidianFeedback(null);
      setObsidianSyncState("idle");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [obsidianFeedback]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;
      const next = currentNodes.map((node) => {
        const shouldBeSelected = node.id === selectedNodeId;
        const isSelected =
          (node.data as { selected?: boolean }).selected === true;
        if (shouldBeSelected === isSelected) return node;
        changed = true;
        return {
          ...node,
          data: { ...node.data, selected: shouldBeSelected },
        };
      });
      return changed ? next : currentNodes;
    });
  }, [selectedNodeId, setNodes]);

  useEffect(() => {
    let changed = false;
    const updated = treeDataRef.current.nodes.map((node) => {
      const flowNode = nodes.find((n) => n.id === node.id);
      if (!flowNode) return node;
      if (
        flowNode.position.x === node.positionX &&
        flowNode.position.y === node.positionY
      ) {
        return node;
      }
      changed = true;
      return {
        ...node,
        positionX: flowNode.position.x,
        positionY: flowNode.position.y,
      };
    });
    if (changed) {
      treeDataRef.current.nodes = updated;
    }
  }, [nodes]);

  const buildRequestHeaders = useCallback(
    (includeJson = false) => {
      const headers: Record<string, string> = includeJson
        ? { "Content-Type": "application/json" }
        : {};

      if (sharedEditToken) {
        headers[EDIT_TOKEN_HEADER] = sharedEditToken;
      }

      return headers;
    },
    [sharedEditToken]
  );

  const getCurrentTreeSnapshot = useCallback((): SkillTreeData => {
    const positions = new Map(
      nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }])
    );
    const statuses = new Map(
      nodes.map((node) => [
        node.id,
        ((node.data as { status?: NodeStatus }).status ?? "available") as NodeStatus,
      ])
    );

    return {
      ...treeDataRef.current,
      isPublic: shareMode !== "private",
      shareMode,
      nodes: treeDataRef.current.nodes.map((node) => ({
        ...node,
        positionX: positions.get(node.id)?.x ?? node.positionX,
        positionY: positions.get(node.id)?.y ?? node.positionY,
        status: statuses.get(node.id) ?? node.status,
      })),
      edges: [...treeDataRef.current.edges],
    };
  }, [nodes, shareMode]);

  const recomputeStatuses = useCallback(() => {
    const snapshot = getCurrentTreeSnapshot();
    const statusMap = computeNodeStatuses(snapshot.nodes, snapshot.edges);

    treeDataRef.current.nodes = snapshot.nodes.map((node) => ({
      ...node,
      status: statusMap.get(node.id) ?? node.status,
    }));

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const nextStatus = statusMap.get(node.id);
        if (!nextStatus) return node;
        return {
          ...node,
          data: { ...node.data, status: nextStatus },
        };
      })
    );
  }, [getCurrentTreeSnapshot, setNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (
        effectiveCanEdit &&
        changes.some((change) => change.type === "position")
      ) {
        setSaveState((current) => (current === "saving" ? current : "unsaved"));
      }

      onNodesChangeBase(changes);
    },
    [effectiveCanEdit, onNodesChangeBase]
  );

  const handleExportPortable = useCallback(() => {
    const snapshot = getCurrentTreeSnapshot();
    downloadJsonFile(
      createDownloadFileName(snapshot.title, "portable"),
      buildPortableTreeExport(snapshot)
    );
  }, [getCurrentTreeSnapshot]);

  const handleExportBackup = useCallback(() => {
    const snapshot = getCurrentTreeSnapshot();
    downloadJsonFile(
      createDownloadFileName(snapshot.title, "backup"),
      buildBackupTreeExport(snapshot)
    );
  }, [getCurrentTreeSnapshot]);

  const openImportPicker = useCallback((mode: ImportMode) => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      try {
        const payload = await file.text();
        const importMode = importModeRef.current;
        const endpoint =
          importMode === "new"
            ? "/api/trees/import"
            : `/api/trees/${tree.id}/import`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({ payload }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Import failed"
          );
        }

        if (importMode === "new" && typeof data.treeId === "string") {
          window.location.assign(`/tree/${data.treeId}`);
          return;
        }

        window.location.reload();
      } catch (error) {
        window.alert(
          error instanceof Error ? error.message : "Failed to import JSON"
        );
      }
    },
    [buildRequestHeaders, tree.id]
  );

  const handleSave = useCallback(async () => {
    if (!effectiveCanEdit) return;

    const snapshot = getCurrentTreeSnapshot();
    setSaveState("saving");

    try {
      for (const node of snapshot.nodes) {
        await fetch(`/api/trees/${tree.id}/nodes/${node.id}`, {
          method: "PUT",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({
            positionX: node.positionX,
            positionY: node.positionY,
          }),
        });
      }

      treeDataRef.current.nodes = snapshot.nodes;
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("failed");
    }
  }, [buildRequestHeaders, effectiveCanEdit, getCurrentTreeSnapshot, tree.id]);

  const handlePushObsidian = useCallback(async () => {
    if (!canEdit) return;

    setObsidianSyncState("syncing");
    setObsidianFeedback("Writing Obsidian notes...");

    try {
      if (effectiveCanEdit) {
        await handleSave();
      }

      const response = await fetch(`/api/obsidian/trees/${tree.id}/push`, {
        method: "POST",
        headers: buildRequestHeaders(true),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Obsidian push failed");
      }

      setObsidianSyncState("idle");
      setObsidianFeedback(`Pushed ${data.nodeCount ?? 0} nodes to Obsidian`);
    } catch (error) {
      setObsidianSyncState("failed");
      setObsidianFeedback(error instanceof Error ? error.message : "Obsidian push failed");
    }
  }, [buildRequestHeaders, canEdit, effectiveCanEdit, handleSave, tree.id]);

  const handlePullObsidian = useCallback(async () => {
    if (!canEdit) return;

    const confirmed = window.confirm(
      "Pull from Obsidian will replace this tree with the Markdown notes in your vault. Continue?"
    );
    if (!confirmed) return;

    setObsidianSyncState("syncing");
    setObsidianFeedback("Reading Obsidian notes...");

    try {
      const response = await fetch(`/api/obsidian/trees/${tree.id}/pull`, {
        method: "POST",
        headers: buildRequestHeaders(true),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Obsidian pull failed");
      }

      setObsidianSyncState("idle");
      setObsidianFeedback(`Pulled ${data.nodeCount ?? 0} nodes from Obsidian`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setObsidianSyncState("failed");
      setObsidianFeedback(error instanceof Error ? error.message : "Obsidian pull failed");
    }
  }, [buildRequestHeaders, canEdit, tree.id]);

  const handleChangeShareMode = useCallback(
    async (mode: ShareMode) => {
      const response = await fetch(`/api/trees/${tree.id}/share`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({ shareMode: mode }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to update sharing"
        );
      }

      setShareMode(data.shareMode);
      treeDataRef.current = {
        ...treeDataRef.current,
        shareMode: data.shareMode,
        isPublic: data.shareMode !== "private",
      };

      const shareUrl = data.editUrl ?? data.readUrl ?? null;
      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setShareFeedback(
            data.editUrl ? "Editable link copied" : "Public link copied"
          );
        } catch {
          setShareFeedback(shareUrl);
        }
      } else {
        setShareFeedback("Sharing disabled");
      }
    },
    [buildRequestHeaders, tree.id]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (pickMode) {
      if (node.id !== pickMode.anchorNodeId) {
        setPickEdgeTypePopup({
          direction: pickMode.direction,
          anchorNodeId: pickMode.anchorNodeId,
          targetNodeId: node.id,
        });
      }
      setPickMode(null);
      return;
    }
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [pickMode]);

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      fitView({ nodes: [{ id: node.id }], duration: 400, padding: 0.5 });
    },
    [fitView]
  );

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!effectiveCanEdit || !connection.source || !connection.target) return;

      const pendingEdge = {
        ...connection,
        type: "skillEdge",
        data: { type: "prerequisite" },
      };
      setEdges((currentEdges) => addEdge(pendingEdge, currentEdges));

      try {
        const response = await fetch(`/api/trees/${tree.id}/edges`, {
          method: "POST",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({
            sourceNodeId: connection.source,
            targetNodeId: connection.target,
            type: "prerequisite",
          }),
        });

        const savedEdge = await response.json();
        if (!response.ok) {
          throw new Error("Failed to save edge");
        }

        setEdges((currentEdges) =>
          currentEdges.map((edge) =>
            edge.source === connection.source &&
            edge.target === connection.target &&
            edge.id.startsWith("xy-edge__")
              ? { ...edge, id: savedEdge.id }
              : edge
          )
        );

        treeDataRef.current.edges.push(savedEdge);
      } catch {
        setEdges((currentEdges) =>
          currentEdges.filter(
            (edge) =>
              !(
                edge.source === connection.source &&
                edge.target === connection.target &&
                edge.id.startsWith("xy-edge__")
              )
          )
        );
      }

      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setEdges, tree.id]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
    setPickMode(null);
    setPickEdgeTypePopup(null);
  }, []);

  const handleAddNode = useCallback(async () => {
    if (!effectiveCanEdit) return;

    const snapshot = getCurrentTreeSnapshot();
    const nextPosition = findAvailableNodePosition(snapshot.nodes, {
      anchorNodeId: selectedNodeId,
      direction: selectedNodeId ? "below" : "parallel",
    });

    const response = await fetch(`/api/trees/${tree.id}/nodes`, {
      method: "POST",
      headers: buildRequestHeaders(true),
      body: JSON.stringify({
        title: "New Step",
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      }),
    });

    const node = await response.json();
    if (!response.ok) {
      throw new Error("Failed to create node");
    }

    treeDataRef.current.nodes.push(node);
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: node.id,
        type: "skillNode",
        position: { x: node.positionX, y: node.positionY },
        data: {
          title: node.title,
          status: node.status,
          difficulty: node.difficulty,
          progress: node.progress,
          description: node.description,
          selected: false,
        },
      },
    ]);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    recomputeStatuses();
  }, [
    buildRequestHeaders,
    effectiveCanEdit,
    getCurrentTreeSnapshot,
    recomputeStatuses,
    selectedNodeId,
    setNodes,
    tree.id,
  ]);

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!effectiveCanEdit) return;

      await fetch(`/api/trees/${tree.id}/nodes/${nodeId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(),
      });

      treeDataRef.current.nodes = treeDataRef.current.nodes.filter(
        (node) => node.id !== nodeId
      );
      treeDataRef.current.edges = treeDataRef.current.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
      );
      setNodes((currentNodes) =>
        currentNodes.filter((node) => node.id !== nodeId)
      );
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        )
      );

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }

      setContextMenu(null);
      recomputeStatuses();
    },
    [
      buildRequestHeaders,
      effectiveCanEdit,
      recomputeStatuses,
      selectedNodeId,
      setEdges,
      setNodes,
      tree.id,
    ]
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!effectiveCanEdit) return;

      const original = treeDataRef.current.nodes.find((node) => node.id === nodeId);
      if (!original) return;

      const nextPosition = findAvailableNodePosition(
        getCurrentTreeSnapshot().nodes,
        {
          anchorNodeId: nodeId,
          direction: "parallel",
        }
      );

      const response = await fetch(`/api/trees/${tree.id}/nodes`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          title: `${original.title} (copy)`,
          description: original.description,
          difficulty: original.difficulty,
          estimatedHours: original.estimatedHours,
          positionX: nextPosition.x,
          positionY: nextPosition.y,
          subTasks: original.subTasks,
          resources: original.resources,
          notes: original.notes,
        }),
      });

      const node = await response.json();
      if (!response.ok) {
        throw new Error("Failed to duplicate node");
      }

      treeDataRef.current.nodes.push(node);
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: node.id,
          type: "skillNode",
          position: { x: node.positionX, y: node.positionY },
          data: {
            title: node.title,
            status: node.status,
            difficulty: node.difficulty,
            progress: node.progress,
            description: node.description,
            selected: false,
          },
        },
      ]);
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setContextMenu(null);
      recomputeStatuses();
    },
    [
      buildRequestHeaders,
      effectiveCanEdit,
      getCurrentTreeSnapshot,
      recomputeStatuses,
      setNodes,
      tree.id,
    ]
  );

  const handleUpdateNode = useCallback(
    async (updatedNode: SkillNodeData) => {
      if (!effectiveCanEdit) return;

      await fetch(`/api/trees/${tree.id}/nodes/${updatedNode.id}`, {
        method: "PUT",
        headers: buildRequestHeaders(true),
        body: JSON.stringify(updatedNode),
      });

      const nextNodes = applyNodeUpdateWithStatuses(
        treeDataRef.current.nodes,
        updatedNode,
        treeDataRef.current.edges
      );

      treeDataRef.current.nodes = nextNodes;
      const nodesById = new Map(nextNodes.map((node) => [node.id, node]));

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          nodesById.has(node.id)
            ? {
                ...node,
                data: {
                  title: nodesById.get(node.id)?.title,
                  status: nodesById.get(node.id)?.status,
                  difficulty: nodesById.get(node.id)?.difficulty,
                  progress: nodesById.get(node.id)?.progress,
                  description: nodesById.get(node.id)?.description,
                  selected: node.id === selectedNodeId,
                },
              }
            : node
        )
      );
    },
    [
      buildRequestHeaders,
      effectiveCanEdit,
      selectedNodeId,
      setNodes,
      tree.id,
    ]
  );

  const handleQuickStatusChange = useCallback(
    async (nodeId: string, newStatus: NodeStatus) => {
      const node = treeDataRef.current.nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      await handleUpdateNode({ ...node, status: newStatus });
    },
    [handleUpdateNode]
  );

  const handleUpdateEdgeType = useCallback(
    async (edgeId: string, newType: string) => {
      if (!effectiveCanEdit) return;

      await fetch(`/api/trees/${tree.id}/edges/${edgeId}`, {
        method: "PUT",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({ type: newType }),
      });

      treeDataRef.current.edges = treeDataRef.current.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              type: newType as "prerequisite" | "recommended" | "optional",
            }
          : edge
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === edgeId
            ? { ...edge, data: { ...edge.data, type: newType } }
            : edge
        )
      );
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setEdges, tree.id]
  );

  const handleAiEnhance = useCallback(
    async (nodeId: string | null) => {
      if (!effectiveCanEdit) return;

      setAiEnhancing(true);

      try {
        const response = await fetch("/api/enhance", {
          method: "POST",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({ treeId: tree.id, nodeId }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error("AI enhance failed");
        }

        const enhancedNodes = Array.isArray(data.nodes)
          ? (data.nodes as SkillNodeData[])
          : [];

        if (enhancedNodes.length === 0) return;

        treeDataRef.current.nodes = mergeNodeUpdates(
          treeDataRef.current.nodes,
          enhancedNodes
        );

        const updatesById = new Map(
          treeDataRef.current.nodes.map((node) => [node.id, node])
        );
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const updatedNode = updatesById.get(node.id);
            if (!updatedNode) return node;
            return {
              ...node,
              data: {
                ...node.data,
                title: updatedNode.title,
                status: updatedNode.status,
                difficulty: updatedNode.difficulty,
                progress: updatedNode.progress,
                description: updatedNode.description,
              },
            };
          })
        );

        recomputeStatuses();
      } finally {
        setAiEnhancing(false);
      }
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setNodes, tree.id]
  );

  const handleAiSuggest = useCallback(
    async (nodeId: string, direction: "above" | "below" | "parallel") => {
      if (!effectiveCanEdit) return;

      setAiEnhancing(true);

      try {
        const preferredPosition = findAvailableNodePosition(
          getCurrentTreeSnapshot().nodes,
          {
            anchorNodeId: nodeId,
            direction,
          }
        );

        const response = await fetch("/api/suggest", {
          method: "POST",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({
            treeId: tree.id,
            nodeId,
            direction,
            preferredPositionX: preferredPosition.x,
            preferredPositionY: preferredPosition.y,
          }),
        });

        if (!response.ok) {
          throw new Error("AI suggest failed");
        }

        const { node: newNode, edge: newEdge } = await response.json();

        treeDataRef.current.nodes.push(newNode);
        setNodes((currentNodes) => [
          ...currentNodes,
          {
            id: newNode.id,
            type: "skillNode",
            position: { x: newNode.positionX, y: newNode.positionY },
            data: {
              title: newNode.title,
              status: newNode.status,
              difficulty: newNode.difficulty,
              progress: newNode.progress,
              description: newNode.description,
              selected: false,
            },
          },
        ]);

        if (newEdge) {
          treeDataRef.current.edges.push(newEdge);
          setEdges((currentEdges) => [
            ...currentEdges,
            {
              id: newEdge.id,
              source: newEdge.sourceNodeId,
              target: newEdge.targetNodeId,
              type: "skillEdge",
              data: { type: newEdge.type },
            },
          ]);
        }

        setSelectedNodeId(newNode.id);
        setSelectedEdgeId(null);
        recomputeStatuses();
      } finally {
        setAiEnhancing(false);
      }
    },
    [
      buildRequestHeaders,
      effectiveCanEdit,
      getCurrentTreeSnapshot,
      recomputeStatuses,
      setEdges,
      setNodes,
      tree.id,
    ]
  );

  const handleAiSubTree = useCallback(
    async (nodeId: string, maxDepth: number) => {
      if (!effectiveCanEdit) return;

      setAiEnhancing(true);

      try {
        const response = await fetch("/api/generate-subtree", {
          method: "POST",
          headers: buildRequestHeaders(true),
          body: JSON.stringify({
            treeId: tree.id,
            nodeId,
            maxDepth,
          }),
        });

        if (!response.ok) {
          throw new Error("AI sub-tree generation failed");
        }

        const data = await response.json();
        const newNodes = Array.isArray(data.nodes) ? data.nodes : [];
        const newEdges = Array.isArray(data.edges) ? data.edges : [];

        for (const newNode of newNodes) {
          treeDataRef.current.nodes.push(newNode);
          setNodes((currentNodes) => [
            ...currentNodes,
            {
              id: newNode.id,
              type: "skillNode",
              position: { x: newNode.positionX, y: newNode.positionY },
              data: {
                title: newNode.title,
                status: newNode.status,
                difficulty: newNode.difficulty,
                progress: newNode.progress,
                description: newNode.description,
                selected: false,
              },
            },
          ]);
        }

        for (const newEdge of newEdges) {
          treeDataRef.current.edges.push(newEdge);
          setEdges((currentEdges) => [
            ...currentEdges,
            {
              id: newEdge.id,
              source: newEdge.sourceNodeId,
              target: newEdge.targetNodeId,
              type: "skillEdge",
              data: { type: newEdge.type },
            },
          ]);
        }

        recomputeStatuses();
      } finally {
        setAiEnhancing(false);
      }
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setEdges, setNodes, tree.id]
  );

  const handleAddNodeWithEdge = useCallback(
    async (direction: "above" | "below", anchorNodeId: string, edgeType: EdgeType) => {
      if (!effectiveCanEdit) return;

      const snapshot = getCurrentTreeSnapshot();
      const nextPosition = findAvailableNodePosition(snapshot.nodes, {
        anchorNodeId,
        direction,
      });

      const response = await fetch(`/api/trees/${tree.id}/nodes`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          title: "New Step",
          positionX: nextPosition.x,
          positionY: nextPosition.y,
        }),
      });

      const newNode = await response.json();
      if (!response.ok) throw new Error("Failed to create node");

      treeDataRef.current.nodes.push(newNode);
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: newNode.id,
          type: "skillNode",
          position: { x: newNode.positionX, y: newNode.positionY },
          data: {
            title: newNode.title,
            status: newNode.status,
            difficulty: newNode.difficulty,
            progress: newNode.progress,
            description: newNode.description,
            selected: false,
          },
        },
      ]);

      // above: new node is prerequisite -> source=new, target=anchor
      // below: anchor leads to new -> source=anchor, target=new
      const sourceId = direction === "above" ? newNode.id : anchorNodeId;
      const targetId = direction === "above" ? anchorNodeId : newNode.id;

      const edgeResponse = await fetch(`/api/trees/${tree.id}/edges`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: edgeType,
        }),
      });

      const savedEdge = await edgeResponse.json();
      if (edgeResponse.ok) {
        treeDataRef.current.edges.push(savedEdge);
        setEdges((currentEdges) => [
          ...currentEdges,
          {
            id: savedEdge.id,
            source: savedEdge.sourceNodeId,
            target: savedEdge.targetNodeId,
            type: "skillEdge",
            data: { type: savedEdge.type },
          },
        ]);
      }

      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, getCurrentTreeSnapshot, recomputeStatuses, setEdges, setNodes, tree.id]
  );

  const handleLinkExistingNode = useCallback(
    async (direction: "above" | "below", anchorNodeId: string, targetNodeId: string, edgeType: EdgeType) => {
      if (!effectiveCanEdit) return;

      const sourceId = direction === "above" ? targetNodeId : anchorNodeId;
      const targetId = direction === "above" ? anchorNodeId : targetNodeId;

      const response = await fetch(`/api/trees/${tree.id}/edges`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: edgeType,
        }),
      });

      const savedEdge = await response.json();
      if (!response.ok) throw new Error("Failed to link nodes");

      treeDataRef.current.edges.push(savedEdge);
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: savedEdge.id,
          source: savedEdge.sourceNodeId,
          target: savedEdge.targetNodeId,
          type: "skillEdge",
          data: { type: savedEdge.type },
        },
      ]);

      setPickMode(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setEdges, tree.id]
  );

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!effectiveCanEdit) return;

      await fetch(`/api/trees/${tree.id}/edges/${edgeId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(),
      });

      treeDataRef.current.edges = treeDataRef.current.edges.filter((e) => e.id !== edgeId);
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== edgeId));

      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, selectedEdgeId, setEdges, tree.id]
  );

  const shortcutActions = useMemo(
    () => ({
      onDelete: () => {
        if (effectiveCanEdit && selectedNodeId) {
          void handleDeleteNode(selectedNodeId);
        }
      },
      onDuplicate: () => {
        if (effectiveCanEdit && selectedNodeId) {
          void handleDuplicateNode(selectedNodeId);
        }
      },
      onSave: () => {
        if (effectiveCanEdit) {
          void handleSave();
        }
      },
      onDeselect: () => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setContextMenu(null);
        setPickMode(null);
        setPickEdgeTypePopup(null);
      },
    }),
    [
      effectiveCanEdit,
      handleDeleteNode,
      handleDuplicateNode,
      handleSave,
      selectedNodeId,
    ]
  );

  useKeyboardShortcuts(selectedNodeId, shortcutActions);

  return (
    <div className="h-screen flex flex-col bg-poe-void">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <WorldHeader
        title={tree.title}
        onSave={handleSave}
        onAddNode={() => {
          void handleAddNode();
        }}
        onChangeShareMode={handleChangeShareMode}
        onExportPortable={handleExportPortable}
        onExportBackup={handleExportBackup}
        onImportNew={() => openImportPicker("new")}
        onImportReplace={() => openImportPicker("replace")}
        onPushObsidian={handlePushObsidian}
        onPullObsidian={handlePullObsidian}
        onToggleMode={() => setIsReadOnly((current) => !current)}
        shareMode={shareMode}
        canEdit={canEdit}
        canManageShare={canManageShare}
        isReadOnly={isReadOnly}
        saveState={saveState}
        obsidianSyncState={obsidianSyncState}
        shareFeedback={shareFeedback}
        obsidianFeedback={obsidianFeedback}
      />

      <div className="flex-1 flex min-h-0">
        <div className={`flex-1 relative ${pickMode ? "poe-pick-mode" : ""}`}>
          <CanvasParticles />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={effectiveCanEdit ? onConnect : undefined}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={effectiveCanEdit}
            nodesConnectable={effectiveCanEdit}
            fitView
            className="poe-canvas-bg"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={50}
              size={1}
              color="rgba(196,148,26,0.04)"
            />
            <Controls
              className="!bg-poe-panel !border-poe-border-dim !rounded-md [&>button]:!bg-poe-panel [&>button]:!border-poe-border-dim [&>button]:!text-poe-text-dim [&>button:hover]:!text-poe-text-primary"
            />
            <MiniMap
              className="!bg-poe-obsidian !border-poe-border-dim !rounded-md"
              nodeColor={(node) => {
                const status = (node.data as { status?: string }).status;
                if (status === "completed") return "#0d9668";
                if (status === "in_progress") return "#5b5ef0";
                if (status === "available") return "#c4941a";
                return "#2a2a35";
              }}
              maskColor="rgba(5,5,16,0.85)"
            />
          </ReactFlow>

          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              nodeStatus={
                treeDataRef.current.nodes.find(
                  (node) => node.id === contextMenu.nodeId
                )?.status ?? "available"
              }
              canEdit={effectiveCanEdit}
              onDelete={() => {
                void handleDeleteNode(contextMenu.nodeId);
              }}
              onDuplicate={() => {
                void handleDuplicateNode(contextMenu.nodeId);
              }}
              onStatusChange={(status) => {
                void handleQuickStatusChange(contextMenu.nodeId, status);
              }}
              onZoomToNode={() => {
                fitView({
                  nodes: [{ id: contextMenu.nodeId }],
                  duration: 400,
                  padding: 0.5,
                });
                setContextMenu(null);
              }}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Pick mode banner */}
          <AnimatePresence>
            {pickMode && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-md border border-poe-gold-mid/60 bg-poe-obsidian/95 text-sm text-poe-gold-bright font-mono flex items-center gap-3"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 30px rgba(196,148,26,0.1)" }}
              >
                <motion.span
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  Click a step to connect
                </motion.span>
                <button
                  onClick={() => setPickMode(null)}
                  className="text-poe-text-dim hover:text-poe-danger text-xs transition-colors duration-150"
                >
                  ESC
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pick mode edge type popup */}
          <AnimatePresence>
            {pickEdgeTypePopup && (
              <>
                <motion.div
                  className="fixed inset-0 z-40"
                  onClick={() => setPickEdgeTypePopup(null)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-poe-border-mid rounded-md p-3 min-w-[200px]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                  style={{
                    background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
                  }}
                >
                  <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-2">
                    Connection Type
                  </div>
                  {([
                    { value: "prerequisite" as EdgeType, label: "Prerequisite", color: "text-poe-gold-bright border-poe-gold-mid" },
                    { value: "recommended" as EdgeType, label: "Recommended", color: "text-poe-energy-blue border-poe-energy-blue" },
                    { value: "optional" as EdgeType, label: "Optional", color: "text-poe-text-dim border-poe-border-mid" },
                  ]).map((opt, i) => (
                    <motion.button
                      key={opt.value}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                      onClick={() => {
                        void handleLinkExistingNode(
                          pickEdgeTypePopup.direction,
                          pickEdgeTypePopup.anchorNodeId,
                          pickEdgeTypePopup.targetNodeId,
                          opt.value
                        );
                        setPickEdgeTypePopup(null);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded border transition-colors duration-150 mb-1 ${opt.color} hover:bg-white/5`}
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <InspectorPanel
          node={selectedNode}
          selectedEdge={
            selectedEdgeId
              ? {
                  id: selectedEdgeId,
                  type:
                    ((edges.find((edge) => edge.id === selectedEdgeId)?.data as {
                      type?: string;
                    })?.type ?? "prerequisite"),
                }
              : null
          }
          onUpdateEdgeType={(edgeId, type) => {
            void handleUpdateEdgeType(edgeId, type);
          }}
          onUpdate={handleUpdateNode}
          onDelete={(nodeId) => {
            void handleDeleteNode(nodeId);
          }}
          onDuplicate={(nodeId) => {
            void handleDuplicateNode(nodeId);
          }}
          onAddNode={() => {
            void handleAddNode();
          }}
          onAiEnhance={(nodeId) => {
            void handleAiEnhance(nodeId);
          }}
          onAiSuggest={(nodeId, direction) => {
            void handleAiSuggest(nodeId, direction);
          }}
          onAiSubTree={(nodeId, maxDepth) => {
            void handleAiSubTree(nodeId, maxDepth);
          }}
          aiEnhancing={aiEnhancing}
          canEdit={canEdit}
          isReadOnly={isReadOnly}
          allNodes={treeDataRef.current.nodes}
          allEdges={treeDataRef.current.edges}
          onAddNodeWithEdge={(direction, anchorNodeId, edgeType) => {
            void handleAddNodeWithEdge(direction, anchorNodeId, edgeType);
          }}
          onLinkExistingNode={(direction, anchorNodeId, targetNodeId, edgeType) => {
            void handleLinkExistingNode(direction, anchorNodeId, targetNodeId, edgeType);
          }}
          onDeleteEdge={(edgeId) => {
            void handleDeleteEdge(edgeId);
          }}
          onStartPickMode={(direction, anchorNodeId) => {
            setPickMode({ direction, anchorNodeId });
          }}
          pickModeActive={!!pickMode}
        />
      </div>

      <JourneyStatusBar
        nodes={nodes.map((node) => ({
          status: ((node.data as { status?: string }).status ?? "available"),
          progress: ((node.data as { progress?: number }).progress ?? 0),
        }))}
        selectedNodeTitle={selectedNode?.title ?? null}
      />
    </div>
  );
}

export function SkillTreeEditor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
