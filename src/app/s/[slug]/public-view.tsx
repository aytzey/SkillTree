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
    id: n.id,
    type: "skillNode",
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      status: n.status,
      difficulty: n.difficulty,
      progress: n.progress,
      description: n.description,
      selected: selectedNode?.id === n.id,
    },
    draggable: false,
  }));

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "skillEdge",
    data: { type: e.type },
  }));

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const fullNode = nodes.find((n) => n.id === node.id);
    if (fullNode) setSelectedNode(fullNode);
  }, [nodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-poe-void">
      <div className="poe-header relative z-10">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-between px-5">
          <div>
            <h1 className="text-lg font-cinzel font-semibold text-poe-text-primary">{title}</h1>
            <p className="text-xs text-poe-text-dim">by {authorName}</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider bg-poe-energy-blue/10 text-poe-energy-blue px-3 py-1 rounded border border-poe-energy-blue/20">
            Read-only
          </span>
        </div>
        <div className="poe-ornate-border" />
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            className="poe-canvas-bg"
          >
            <Background variant={BackgroundVariant.Dots} gap={50} size={1} color="rgba(196,148,26,0.04)" />
            <Controls className="!bg-poe-panel !border-poe-border-dim !rounded-md [&>button]:!bg-poe-panel [&>button]:!border-poe-border-dim [&>button]:!text-poe-text-dim" />
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
        </div>

        <div className="poe-inspector w-80 h-full flex flex-col">
          <div className="px-4 py-3 border-b border-poe-border-dim">
            <h3 className="text-sm font-cinzel font-semibold text-poe-text-dim uppercase tracking-wider">
              Codex
            </h3>
          </div>

          {!selectedNode ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-xs text-poe-text-dim text-center">Click a node to view details</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto poe-scrollbar p-4">
              <h2 className="text-base font-semibold text-poe-gold-bright mb-1">{selectedNode.title}</h2>
              <div className="text-[10px] uppercase tracking-wider font-mono text-poe-text-dim mb-3">
                {selectedNode.status.replace("_", " ")}
              </div>

              {selectedNode.description && (
                <p className="text-sm text-poe-text-secondary mb-4 leading-relaxed">{selectedNode.description}</p>
              )}

              <div className="poe-section-divider my-3" />

              <div className="flex items-center gap-4 mb-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= selectedNode.difficulty ? "bg-poe-gold-mid" : "bg-poe-border-dim"}`} />
                  ))}
                </div>
                {selectedNode.estimatedHours && (
                  <span className="text-xs text-poe-text-dim font-mono">{selectedNode.estimatedHours}h est.</span>
                )}
              </div>

              {selectedNode.status === "in_progress" && (
                <div className="mb-4">
                  <div className="h-1 bg-poe-void rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple rounded-full" style={{ width: `${selectedNode.progress}%` }} />
                  </div>
                  <span className="text-[10px] text-poe-text-dim font-mono">{selectedNode.progress}%</span>
                </div>
              )}

              {selectedNode.subTasks.length > 0 && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Sub-tasks</h4>
                  <div className="space-y-1">
                    {selectedNode.subTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded border flex items-center justify-center text-[8px] ${t.done ? "bg-poe-complete-green/20 border-poe-complete-green text-poe-complete-bright" : "border-poe-border-mid text-transparent"}`}>
                          {t.done && "\u2713"}
                        </span>
                        <span className={t.done ? "text-poe-text-dim line-through" : "text-poe-text-primary"}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {selectedNode.resources.length > 0 && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Resources</h4>
                  <div className="space-y-1">
                    {selectedNode.resources.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-poe-energy-blue hover:text-poe-energy-purple transition truncate">
                        {r.title}
                      </a>
                    ))}
                  </div>
                </>
              )}

              {selectedNode.notes && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Notes</h4>
                  <p className="text-xs text-poe-text-secondary whitespace-pre-wrap leading-relaxed">{selectedNode.notes}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
