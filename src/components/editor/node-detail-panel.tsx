"use client";

import type { SkillNodeData } from "@/types";

interface NodeDetailPanelProps {
  node: SkillNodeData;
  onUpdate: (node: SkillNodeData) => void;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-rpg-bg-secondary border-l border-rpg-border p-4 overflow-y-auto z-30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{node.title}</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl"
        >
          &times;
        </button>
      </div>
      <p className="text-sm text-slate-400">Full panel in Task 9</p>
    </div>
  );
}
