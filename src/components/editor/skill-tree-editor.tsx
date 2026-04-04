"use client";

import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "./skill-node";
import { SkillEdge } from "./skill-edge";
import { Toolbar } from "./toolbar";
import { ProgressBar } from "./progress-bar";
import { NodeDetailPanel } from "./node-detail-panel";
import { ContextMenu } from "./context-menu";
import type { SkillTreeData, SkillNodeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

interface EditorProps {
  tree: SkillTreeData;
}

function toFlowNodes(nodes: SkillNodeData[]): Node[] {
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

export function SkillTreeEditor({ tree }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(tree.nodes)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(tree.edges)
  );
  const [selectedNode, setSelectedNode] = useState<SkillNodeData | null>(null);
  const [isPublic, setIsPublic] = useState(tree.isPublic);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const treeDataRef = useRef(tree);

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

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const fullNode = treeDataRef.current.nodes.find(
        (n) => n.id === node.id
      );
      if (fullNode) setSelectedNode(fullNode);
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  async function handleSave() {
    setSaving(true);
    const nodePositions = nodes.map((n) => ({
      id: n.id,
      positionX: n.position.x,
      positionY: n.position.y,
    }));
    for (const np of nodePositions) {
      await fetch(`/api/trees/${tree.id}/nodes/${np.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionX: np.positionX,
          positionY: np.positionY,
        }),
      });
    }
    setSaving(false);
  }

  async function handleShare() {
    const res = await fetch(`/api/trees/${tree.id}/share`, { method: "POST" });
    const data = await res.json();
    setIsPublic(data.isPublic);
    if (data.shareUrl) {
      navigator.clipboard.writeText(
        `${window.location.origin}${data.shareUrl}`
      );
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
        },
      },
    ]);
  }

  async function handleDeleteNode(nodeId: string) {
    await fetch(`/api/trees/${tree.id}/nodes/${nodeId}`, { method: "DELETE" });
    treeDataRef.current.nodes = treeDataRef.current.nodes.filter(
      (n) => n.id !== nodeId
    );
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
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
              },
            }
          : n
      )
    );
    setSelectedNode(updated);
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        title={tree.title}
        onSave={handleSave}
        onShare={handleShare}
        onAiExpand={() => {}}
        onAddNode={handleAddNode}
        isPublic={isPublic}
        saving={saving}
      />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-rpg-bg"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={40}
            size={1}
            color="rgba(99,102,241,0.08)"
          />
          <Controls className="!bg-rpg-card !border-rpg-border !rounded-lg [&>button]:!bg-rpg-card [&>button]:!border-rpg-border [&>button]:!text-white" />
          <MiniMap
            className="!bg-rpg-bg-secondary !border-rpg-border !rounded-lg"
            nodeColor="#6366f1"
            maskColor="rgba(10,10,26,0.8)"
          />
        </ReactFlow>
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onUpdate={handleUpdateNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onDelete={() => handleDeleteNode(contextMenu.nodeId)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
      <ProgressBar
        nodes={nodes.map((n) => ({
          status: (n.data as { status: string }).status,
          progress: (n.data as { progress: number }).progress,
        }))}
      />
    </div>
  );
}
