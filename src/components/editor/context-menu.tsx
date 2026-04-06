"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { NodeStatus } from "@/types";

interface ContextMenuProps {
  x: number;
  y: number;
  nodeStatus: NodeStatus;
  canEdit: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onStatusChange: (status: NodeStatus) => void;
  onZoomToNode: () => void;
  onClose: () => void;
}

const statusActions: { value: NodeStatus; label: string; icon: string }[] = [
  { value: "locked", label: "Set Blocked", icon: "🔒" },
  { value: "available", label: "Set Ready", icon: "⭐" },
  { value: "in_progress", label: "Set In Progress", icon: "⚡" },
  { value: "completed", label: "Set Done", icon: "✓" },
];

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

const menuVariants = {
  hidden: { opacity: 0, scale: 0.92, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -2,
    transition: { duration: 0.12, ease: EASE_OUT },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.15,
      ease: EASE_OUT,
    },
  }),
};

export function ContextMenu({
  x,
  y,
  nodeStatus,
  canEdit,
  onDelete,
  onDuplicate,
  onStatusChange,
  onZoomToNode,
  onClose,
}: ContextMenuProps) {
  const filteredStatuses = statusActions.filter((s) => s.value !== nodeStatus);
  let itemIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="fixed z-50 border border-poe-border-mid rounded-md py-1 min-w-[180px]"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2), 0 0 40px rgba(0,0,0,0.3)",
        }}
        variants={menuVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {canEdit && (
          <>
            <div className="px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-poe-text-dim font-mono mb-1 px-2">
                Status
              </div>
              {filteredStatuses.map((status) => {
                const idx = itemIndex++;
                return (
                  <motion.button
                    key={status.value}
                    custom={idx}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => {
                      onStatusChange(status.value);
                      onClose();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition-colors duration-150 flex items-center gap-2"
                  >
                    <span className="text-[10px] w-4 text-center">{status.icon}</span>
                    {status.label}
                  </motion.button>
                );
              })}
            </div>

            <div className="h-px bg-poe-border-dim mx-2 my-1" />
          </>
        )}

        <div className="px-1 py-1">
          <motion.button
            custom={itemIndex++}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            onClick={() => {
              onZoomToNode();
              onClose();
            }}
            className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition-colors duration-150"
          >
            Zoom to Node
          </motion.button>

          {canEdit && (
            <>
              <motion.button
                custom={itemIndex++}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                onClick={() => {
                  onDuplicate();
                  onClose();
                }}
                className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition-colors duration-150"
              >
                Duplicate
              </motion.button>
              <motion.button
                custom={itemIndex++}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="w-full text-left px-4 py-2 text-sm text-poe-danger hover:bg-poe-danger/10 rounded transition-colors duration-150"
              >
                Delete
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
