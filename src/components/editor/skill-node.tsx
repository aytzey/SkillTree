"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { NodeStatus } from "@/types";

interface SkillNodePayload {
  title: string;
  status: NodeStatus;
  difficulty: number;
  progress: number;
  description: string | null;
}

const statusStyles: Record<NodeStatus, string> = {
  locked: "border-rpg-locked/50 bg-rpg-bg/80 opacity-50 grayscale",
  available:
    "border-rpg-gold bg-rpg-card shadow-[0_0_20px_rgba(245,158,11,0.3)]",
  in_progress:
    "border-rpg-blue bg-rpg-card shadow-[0_0_20px_rgba(99,102,241,0.4)]",
  completed:
    "border-rpg-green bg-rpg-card shadow-[0_0_20px_rgba(16,185,129,0.4)]",
};

const statusIcons: Record<NodeStatus, string> = {
  locked: "\u{1F512}",
  available: "\u{2728}",
  in_progress: "\u{1F504}",
  completed: "\u{2705}",
};

function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress } =
    data as unknown as SkillNodePayload;
  const stars = "\u{2B50}".repeat(difficulty);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`relative px-4 py-3 rounded-xl border-2 min-w-[140px] max-w-[200px] transition-all duration-300 cursor-pointer ${statusStyles[status]}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-rpg-neon !w-3 !h-3 !border-2 !border-rpg-bg"
      />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{statusIcons[status]}</span>
        <span className="text-sm font-semibold text-white truncate">
          {title}
        </span>
      </div>
      <div className="text-xs text-slate-400">{stars}</div>
      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-rpg-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rpg-blue to-rpg-gold rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-rpg-neon !w-3 !h-3 !border-2 !border-rpg-bg"
      />
    </motion.div>
  );
}

export const SkillNode = memo(SkillNodeComponent);
