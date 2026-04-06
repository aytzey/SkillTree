"use client";

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
  { value: "locked", label: "Set Sealed", icon: "🔒" },
  { value: "available", label: "Set Ready", icon: "⭐" },
  { value: "in_progress", label: "Set Active", icon: "⚡" },
  { value: "completed", label: "Set Mastered", icon: "✓" },
];

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
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 border border-poe-border-mid rounded-md shadow-2xl py-1 min-w-[180px] animate-fade-in"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
        }}
      >
        {canEdit && (
          <>
            <div className="px-2 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-poe-text-dim font-mono mb-1 px-2">
                Status
              </div>
              {statusActions
                .filter((status) => status.value !== nodeStatus)
                .map((status) => (
                  <button
                    key={status.value}
                    onClick={() => {
                      onStatusChange(status.value);
                      onClose();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition flex items-center gap-2"
                  >
                    <span className="text-[10px] w-4 text-center">{status.icon}</span>
                    {status.label}
                  </button>
                ))}
            </div>

            <div className="h-px bg-poe-border-dim mx-2 my-1" />
          </>
        )}

        <div className="px-1 py-1">
          <button
            onClick={() => {
              onZoomToNode();
              onClose();
            }}
            className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition"
          >
            Zoom to Node
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => {
                  onDuplicate();
                  onClose();
                }}
                className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition"
              >
                Duplicate
              </button>
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="w-full text-left px-4 py-2 text-sm text-poe-danger hover:bg-poe-danger/10 rounded transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
