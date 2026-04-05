"use client";

interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

export function ContextMenu({ x, y, onDelete, onDuplicate, onClose }: ContextMenuProps) {
  const items: MenuItem[] = [
    { label: "Duplicate", onClick: onDuplicate },
    { label: "Delete", onClick: onDelete, variant: "danger" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 border border-poe-border-mid rounded-md shadow-2xl py-1 min-w-[160px] animate-fade-in"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full text-left px-4 py-2 text-sm transition ${
              item.variant === "danger"
                ? "text-poe-danger hover:bg-poe-danger/10"
                : "text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
