"use client";

interface JourneyStatusBarProps {
  nodes: { status: string; progress: number }[];
  selectedNodeTitle: string | null;
}

export function JourneyStatusBar({ nodes, selectedNodeTitle }: JourneyStatusBarProps) {
  const total = nodes.length;
  if (total === 0) return null;

  const completed = nodes.filter((n) => n.status === "completed").length;
  const inProgress = nodes.filter((n) => n.status === "in_progress").length;
  const available = nodes.filter((n) => n.status === "available").length;
  const locked = nodes.filter((n) => n.status === "locked").length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="h-10 border-t border-poe-border-dim bg-gradient-to-r from-[#0e0e24] to-[#10102a] flex items-center px-5 gap-6 z-10">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1 max-w-xs h-1.5 bg-poe-void rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-poe-gold-dim to-poe-gold-bright rounded-full transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-poe-text-dim font-mono whitespace-nowrap">
          {completed}/{total} mastered
        </span>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-complete-green" />
          {completed}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-progress-blue" />
          {inProgress}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-gold-mid" />
          {available}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-locked-mid" />
          {locked}
        </span>
      </div>

      {selectedNodeTitle && (
        <div className="text-xs text-poe-text-secondary truncate max-w-[200px]">
          <span className="text-poe-text-dim">Selected:</span>{" "}
          <span className="text-poe-gold-mid">{selectedNodeTitle}</span>
        </div>
      )}
    </div>
  );
}
