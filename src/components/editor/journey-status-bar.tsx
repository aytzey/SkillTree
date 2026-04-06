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
    <div className="h-11 border-t border-poe-border-dim bg-gradient-to-r from-[#0e0e24] via-[#10102a] to-[#0e0e24] flex items-center px-5 gap-6 z-10 relative">
      {/* Top progress glow line */}
      <div
        className="absolute top-0 left-0 h-px transition-all duration-1000"
        style={{
          width: `${percent}%`,
          background: percent === 100
            ? "linear-gradient(90deg, transparent, #34d399, transparent)"
            : "linear-gradient(90deg, transparent, #c4941a, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Progress section */}
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xs font-cinzel font-semibold text-poe-gold-bright min-w-[36px]">
          {percent}%
        </span>
        <div className="flex-1 max-w-xs h-1.5 bg-poe-void rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percent}%`,
              background: percent === 100
                ? "linear-gradient(90deg, #0d9668, #34d399)"
                : "linear-gradient(90deg, #8b6914, #c4941a, #e8b828)",
            }}
          />
        </div>
        <span className="text-[10px] text-poe-text-dim font-mono whitespace-nowrap">
          {completed}/{total} steps complete
        </span>
      </div>

      {/* Status counts with glow dots */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim">
        <span className="flex items-center gap-1.5" title="Done">
          <span className="w-2 h-2 rounded-full bg-poe-complete-green shadow-[0_0_4px_rgba(13,150,104,0.5)]" />
          {completed}
        </span>
        <span className="flex items-center gap-1.5" title="In Progress">
          <span className="w-2 h-2 rounded-full bg-poe-progress-blue shadow-[0_0_4px_rgba(91,94,240,0.5)]" />
          {inProgress}
        </span>
        <span className="flex items-center gap-1.5" title="Ready">
          <span className="w-2 h-2 rounded-full bg-poe-gold-mid shadow-[0_0_4px_rgba(196,148,26,0.5)]" />
          {available}
        </span>
        <span className="flex items-center gap-1.5" title="Blocked">
          <span className="w-2 h-2 rounded-full bg-poe-locked-mid" />
          {locked}
        </span>
      </div>

      {/* Selected node */}
      {selectedNodeTitle && (
        <div className="text-xs text-poe-text-secondary truncate max-w-[200px] flex items-center gap-1.5">
          <svg className="w-3 h-3 text-poe-gold-dim shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 15l-2 5L9 9l11 4-5 2z" />
          </svg>
          <span className="text-poe-gold-mid truncate">{selectedNodeTitle}</span>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-[9px] text-poe-text-dim font-mono hidden lg:flex items-center gap-2 opacity-40">
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">Del</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^D</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^S</kbd>
      </div>
    </div>
  );
}
