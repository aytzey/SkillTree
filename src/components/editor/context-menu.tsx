"use client";

interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onDelete, onClose }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-rpg-card border border-rpg-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          onClick={onDelete}
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-rpg-bg transition"
        >
          Delete Node
        </button>
      </div>
    </>
  );
}
