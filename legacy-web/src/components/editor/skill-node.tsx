"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import type { NodeStatus } from "@/types";

interface SkillNodePayload {
  title: string;
  status: NodeStatus;
  difficulty: number;
  progress: number;
  description: string | null;
  selected?: boolean;
}

type NodeTier = "small" | "notable" | "keystone";

function getNodeTier(difficulty: number): NodeTier {
  if (difficulty >= 5) return "keystone";
  if (difficulty >= 3) return "notable";
  return "small";
}

const tierSizes: Record<NodeTier, string> = {
  small: "min-w-[110px] max-w-[140px] px-2.5 py-2",
  notable: "min-w-[140px] max-w-[180px] px-3 py-3",
  keystone: "min-w-[170px] max-w-[220px] px-4 py-4",
};

const tierBorderRadius: Record<NodeTier, string> = {
  small: "rounded-lg",
  notable: "rounded-xl",
  keystone: "rounded-2xl",
};

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

function StatusIcon({ status }: { status: NodeStatus }) {
  const iconClass = "w-3.5 h-3.5";
  switch (status) {
    case "locked":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      );
    case "available":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      );
    case "in_progress":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
        </svg>
      );
    case "completed":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
  }
}

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
            i <= level ? "bg-poe-gold-mid scale-100" : "bg-poe-border-dim scale-90"
          }`}
        />
      ))}
    </div>
  );
}

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

const tooltipVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.97,
    transition: { duration: 0.12, ease: EASE_OUT },
  },
};

function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress, description, selected } =
    data as unknown as SkillNodePayload;
  const [hovered, setHovered] = useState(false);
  const [ripples, setRipples] = useState<number[]>([]);
  const rippleCounter = useRef(0);
  const tier = getNodeTier(difficulty);

  const handleClick = useCallback(() => {
    rippleCounter.current += 1;
    const id = rippleCounter.current;
    setRipples((prev) => [...prev, id]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r !== id));
    }, 500);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      whileTap={status !== "locked" ? { scale: 0.97 } : undefined}
      className={`poe-node poe-node-${tier} ${stateClasses[status]} ${
        selected ? "poe-node-selected" : ""
      } ${tierSizes[tier]} ${tierBorderRadius[tier]} cursor-pointer relative`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Click ripple effects */}
      {ripples.map((id) => (
        <div key={id} className="poe-node-ripple" />
      ))}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-top-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />

      {/* Header: icon + difficulty */}
      <div className="flex items-center justify-between mb-1.5">
        <motion.div
          className={`${statusIndicator[status].color} flex items-center gap-1.5`}
          key={status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        >
          <StatusIcon status={status} />
          {tier === "keystone" && (
            <span className="text-[8px] font-mono uppercase tracking-wider opacity-50">Keystone</span>
          )}
        </motion.div>
        <DifficultyPips level={difficulty} />
      </div>

      {/* Title */}
      <div className={`font-semibold text-poe-text-primary leading-tight truncate ${
        tier === "keystone" ? "text-base" : tier === "notable" ? "text-sm" : "text-xs"
      }`}>
        {title}
      </div>

      {/* Status label — hidden on small-tier nodes to reduce visual clutter */}
      {tier !== "small" && (
        <motion.div
          key={`status-${status}`}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className={`text-[10px] mt-1 uppercase tracking-wider font-mono ${statusIndicator[status].color}`}
        >
          {statusIndicator[status].label}
        </motion.div>
      )}

      {/* Progress bar */}
      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple relative overflow-hidden"
          >
            <div className="absolute inset-0 poe-progress-shimmer" />
          </motion.div>
        </div>
      )}

      {/* Animated Tooltip */}
      <AnimatePresence>
        {hovered && !selected && description && (
          <motion.div
            className="absolute left-1/2 bottom-full mb-3 z-50 pointer-events-none"
            style={{ transform: "translateX(-50%)" }}
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="bg-poe-obsidian/95 border border-poe-border-mid rounded-lg px-3 py-2 shadow-2xl max-w-[220px]"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(196,148,26,0.15)" }}
            >
              <p className="text-[11px] text-poe-text-secondary leading-relaxed line-clamp-3">
                {description}
              </p>
              {status === "in_progress" && (
                <div className="mt-1.5 text-[10px] font-mono text-poe-progress-blue">{progress}% complete</div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-poe-border-mid" />
          </motion.div>
        )}
      </AnimatePresence>

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
