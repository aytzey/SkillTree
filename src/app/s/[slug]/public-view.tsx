"use client";

import { useState, useCallback } from "react";
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "@/components/editor/skill-node";
import { SkillEdge } from "@/components/editor/skill-edge";
import type { SkillNodeData, SkillEdgeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

interface PublicTreeViewProps {
  title: string;
  authorName: string;
  nodes: SkillNodeData[];
  edges: SkillEdgeData[];
}

export function PublicTreeView({ title, authorName, nodes, edges }: PublicTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<SkillNodeData | null>(null);

  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id, type: "skillNode",
    position: { x: n.positionX, y: n.positionY },
    data: { title: n.title, status: n.status, difficulty: n.difficulty, progress: n.progress, description: n.description },
    draggable: false,
  }));

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id, source: e.sourceNodeId, target: e.targetNodeId, type: "skillEdge", data: { type: e.type },
  }));

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const fullNode = nodes.find((n) => n.id === node.id);
    if (fullNode) setSelectedNode(fullNode);
  }, [nodes]);

  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/80 backdrop-blur flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-xs text-slate-400">by {authorName}</p>
        </div>
        <span className="text-xs bg-rpg-neon/20 text-rpg-neon px-2 py-1 rounded-full">Read-only</span>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={flowNodes} edges={flowEdges} onNodeClick={onNodeClick}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          className="bg-rpg-bg"
        >
          <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="rgba(99,102,241,0.08)" />
          <Controls className="!bg-rpg-card !border-rpg-border !rounded-lg [&>button]:!bg-rpg-card [&>button]:!border-rpg-border [&>button]:!text-white" />
          <MiniMap className="!bg-rpg-bg-secondary !border-rpg-border !rounded-lg" nodeColor="#6366f1" maskColor="rgba(10,10,26,0.8)" />
        </ReactFlow>

        {selectedNode && (
          <div className="absolute top-0 right-0 w-80 h-full bg-rpg-bg-secondary border-l border-rpg-border overflow-y-auto z-30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-rpg-gold">{selectedNode.title}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            {selectedNode.description && <p className="text-sm text-slate-300 mb-4">{selectedNode.description}</p>}
            <div className="text-xs text-slate-400 mb-2">Difficulty: {"\u2B50".repeat(selectedNode.difficulty)}</div>
            {selectedNode.estimatedHours && <div className="text-xs text-slate-400 mb-4">Est. {selectedNode.estimatedHours}h</div>}
            {selectedNode.subTasks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-slate-400 mb-2">Sub-tasks</h4>
                {selectedNode.subTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{t.done ? "\u2705" : "\u2B1C"}</span>
                    <span className={t.done ? "text-slate-500 line-through" : "text-white"}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedNode.resources.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-slate-400 mb-2">Resources</h4>
                {selectedNode.resources.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-rpg-neon hover:underline mb-1">{r.title}</a>
                ))}
              </div>
            )}
            {selectedNode.notes && (
              <div>
                <h4 className="text-xs text-slate-400 mb-2">Notes</h4>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedNode.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
