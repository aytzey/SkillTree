"use client";

import { useCallback, useState, useRef, useEffect } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "./skill-node";
import { SkillEdge } from "./skill-edge";
import { WorldHeader } from "./world-header";
import { InspectorPanel } from "./inspector-panel";
import { JourneyStatusBar } from "./journey-status-bar";
import { ContextMenu } from "./context-menu";
import type { SkillTreeData, SkillNodeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface EditorProps {
  tree: SkillTreeData;
}

function toFlowNodes(nodes: SkillNodeData[], selectedId: string | null): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "skillNode",
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      status: n.status,
      difficulty: n.difficulty,
      progress: n.progress,
      description: n.description,
      selected: n.id === selectedId,
    },
  }));
}

function toFlowEdges(edges: SkillTreeData["edges"]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "skillEdge",
    data: { type: e.type },
  }));
}

function EditorInner({ tree }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(tree.nodes, null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(tree.edges)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(tree.isPublic);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const treeDataRef = useRef(tree);
  const { fitView } = useReactFlow();

  const selectedNode = selectedNodeId
    ? treeDataRef.current.nodes.find((n) => n.id === selectedNodeId) || null
    : null;

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      }))
    );
  }, [selectedNodeId, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setContextMenu(null);
    },
    []
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      fitView({ nodes: [{ id: node.id }], duration: 400, padding: 0.5 });
    },
    [fitView]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        type: "skillEdge",
        data: { type: "prerequisite" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  async function handleSave() {
    setSaveState("saving");
    try {
      const nodePositions = nodes.map((n) => ({
        id: n.id,
        positionX: n.position.x,
        positionY: n.position.y,
      }));
      for (const np of nodePositions) {
        await fetch(`/api/trees/${tree.id}/nodes/${np.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionX: np.positionX, positionY: np.positionY }),
        });
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("failed");
    }
  }

  async function handleShare() {
    const res = await fetch(`/api/trees/${tree.id}/share`, { method: "POST" });
    const data = await res.json();
    setIsPublic(data.isPublic);
    if (data.shareUrl) {
      navigator.clipboard.writeText(`${window.location.origin}${data.shareUrl}`);
    }
  }

  async function handleAddNode() {
    const res = await fetch(`/api/trees/${tree.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Skill",
        positionX: Math.random() * 400 + 100,
        positionY: Math.random() * 400 + 100,
      }),
    });
    const node = await res.json();
    treeDataRef.current.nodes.push(node);
    setNodes((nds) => [
      ...nds,
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
  }

  async function handleDeleteNode(nodeId: string) {
    await fetch(`/api/trees/${tree.id}/nodes/${nodeId}`, { method: "DELETE" });
    treeDataRef.current.nodes = treeDataRef.current.nodes.filter((n) => n.id !== nodeId);
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setContextMenu(null);
  }

  async function handleDuplicateNode(nodeId: string) {
    const original = treeDataRef.current.nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const res = await fetch(`/api/trees/${tree.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${original.title} (copy)`,
        description: original.description,
        difficulty: original.difficulty,
        estimatedHours: original.estimatedHours,
        positionX: original.positionX + 50,
        positionY: original.positionY + 50,
        subTasks: original.subTasks,
        resources: original.resources,
        notes: original.notes,
      }),
    });
    const node = await res.json();
    treeDataRef.current.nodes.push(node);
    setNodes((nds) => [
      ...nds,
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
    setContextMenu(null);
  }

  async function handleUpdateNode(updated: SkillNodeData) {
    await fetch(`/api/trees/${tree.id}/nodes/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    treeDataRef.current.nodes = treeDataRef.current.nodes.map((n) =>
      n.id === updated.id ? updated : n
    );
    setNodes((nds) =>
      nds.map((n) =>
        n.id === updated.id
          ? {
              ...n,
              data: {
                title: updated.title,
                status: updated.status,
                difficulty: updated.difficulty,
                progress: updated.progress,
                description: updated.description,
                selected: n.id === selectedNodeId,
              },
            }
          : n
      )
    );
  }

  async function handleAiEnhance(nodeId: string | null) {
    setAiEnhancing(true);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: tree.id, nodeId }),
      });
      if (res.ok) {
        // Reload the page to get fresh data
        window.location.reload();
      }
    } catch {
      // silently fail
    } finally {
      setAiEnhancing(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-poe-void">
      <WorldHeader
        title={tree.title}
        onSave={handleSave}
        onShare={handleShare}
        onAiExpand={() => {}}
        onAddNode={handleAddNode}
        isPublic={isPublic}
        saveState={saveState}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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
              nodeColor={(n) => {
                const status = (n.data as { status: string })?.status;
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
              onDelete={() => handleDeleteNode(contextMenu.nodeId)}
              onDuplicate={() => handleDuplicateNode(contextMenu.nodeId)}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>

        <InspectorPanel
          node={selectedNode}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
          onAddNode={handleAddNode}
          onAiEnhance={handleAiEnhance}
          aiEnhancing={aiEnhancing}
        />
      </div>

      <JourneyStatusBar
        nodes={nodes.map((n) => ({
          status: (n.data as { status: string }).status,
          progress: (n.data as { progress: number }).progress,
        }))}
        selectedNodeTitle={selectedNode?.title || null}
      />
    </div>
  );
}

export function SkillTreeEditor({ tree }: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner tree={tree} />
    </ReactFlowProvider>
  );
}
