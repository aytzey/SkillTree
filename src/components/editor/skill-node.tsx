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
  selected?: boolean;
}

const stateClasses: Record<NodeStatus, string> = {
  locked: "poe-node-locked",
  available: "poe-node-available",
  in_progress: "poe-node-in-progress",
  completed: "poe-node-completed",
};

const stateRingColor: Record<NodeStatus, string> = {
  locked: "#2a2a35",
  available: "#c4941a",
  in_progress: "#5b5ef0",
  completed: "#0d9668",
};

const statusIndicator: Record<NodeStatus, { label: string; color: string }> = {
  locked: { label: "Sealed", color: "text-poe-locked-mid" },
  available: { label: "Ready", color: "text-poe-gold-bright" },
  in_progress: { label: "Active", color: "text-poe-progress-blue" },
  completed: { label: "Mastered", color: "text-poe-complete-bright" },
};

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level ? "bg-poe-gold-mid" : "bg-poe-border-dim"
          }`}
        />
      ))}
    </div>
  );
}

function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress, selected } =
    data as unknown as SkillNodePayload;

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`poe-node ${stateClasses[status]} ${
        selected ? "poe-node-selected" : ""
      } min-w-[130px] max-w-[180px] px-3 py-2.5 cursor-pointer`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-top-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />

      <div className="flex items-center justify-between mb-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: stateRingColor[status] }}
        />
        <DifficultyPips level={difficulty} />
      </div>

      <div className="text-sm font-semibold text-poe-text-primary leading-tight truncate">
        {title}
      </div>

      <div className={`text-[10px] mt-1 uppercase tracking-wider font-mono ${statusIndicator[status].color}`}>
        {statusIndicator[status].label}
      </div>

      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple"
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-bottom-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />
    </motion.div>
  );
}

export const SkillNode = memo(SkillNodeComponent);
