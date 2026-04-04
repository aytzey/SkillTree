"use client";

interface ProgressBarProps {
  nodes: { status: string; progress: number }[];
}

export function ProgressBar({ nodes }: ProgressBarProps) {
  if (nodes.length === 0) return null;
  const completed = nodes.filter((n) => n.status === "completed").length;
  const percent = Math.round((completed / nodes.length) * 100);

  return (
    <div className="h-8 border-t border-rpg-border bg-rpg-bg-secondary/80 flex items-center px-4 gap-3">
      <div className="flex-1 h-1.5 bg-rpg-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rpg-blue to-rpg-green rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 font-mono w-16 text-right">
        {completed}/{nodes.length} ({percent}%)
      </span>
    </div>
  );
}
