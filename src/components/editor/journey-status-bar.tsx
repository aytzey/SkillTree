"use client";

import { motion, AnimatePresence } from "framer-motion";

interface JourneyStatusBarProps {
  nodes: { status: string; progress: number }[];
  selectedNodeTitle: string | null;
}

function AnimatedCount({ value, color }: { value: number; color?: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        className={color}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
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
      <motion.div
        className="absolute top-0 left-0 h-px"
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        style={{
          background: percent === 100
            ? "linear-gradient(90deg, transparent, #34d399, transparent)"
            : "linear-gradient(90deg, transparent, #c4941a, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Progress section */}
      <div className="flex items-center gap-3 flex-1">
        <motion.span
          className="text-xs font-cinzel font-semibold text-poe-gold-bright min-w-[36px]"
          key={percent}
          initial={{ scale: 1.15, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
        >
          {percent}%
        </motion.span>
        <div className="flex-1 max-w-xs h-1.5 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full relative overflow-hidden"
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
            style={{
              background: percent === 100
                ? "linear-gradient(90deg, #0d9668, #34d399)"
                : "linear-gradient(90deg, #8b6914, #c4941a, #e8b828)",
            }}
          >
            <div className="absolute inset-0 poe-progress-shimmer" />
          </motion.div>
        </div>
        <span className="text-[10px] text-poe-text-dim font-mono whitespace-nowrap">
          <AnimatedCount value={completed} />/{total} steps complete
        </span>
      </div>

      {/* Status counts with glow dots */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim">
        <span className="flex items-center gap-1.5" title="Done">
          <span className="w-2 h-2 rounded-full bg-poe-complete-green shadow-[0_0_4px_rgba(13,150,104,0.5)] poe-status-dot" />
          <AnimatedCount value={completed} />
        </span>
        <span className="flex items-center gap-1.5" title="In Progress">
          <span className="w-2 h-2 rounded-full bg-poe-progress-blue shadow-[0_0_4px_rgba(91,94,240,0.5)] poe-status-dot" />
          <AnimatedCount value={inProgress} />
        </span>
        <span className="flex items-center gap-1.5" title="Ready">
          <span className="w-2 h-2 rounded-full bg-poe-gold-mid shadow-[0_0_4px_rgba(196,148,26,0.5)] poe-status-dot" />
          <AnimatedCount value={available} />
        </span>
        <span className="flex items-center gap-1.5" title="Blocked">
          <span className="w-2 h-2 rounded-full bg-poe-locked-mid poe-status-dot" />
          <AnimatedCount value={locked} />
        </span>
      </div>

      {/* Selected node */}
      <AnimatePresence mode="wait">
        {selectedNodeTitle && (
          <motion.div
            key={selectedNodeTitle}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="text-xs text-poe-text-secondary truncate max-w-[200px] flex items-center gap-1.5"
          >
            <svg className="w-3 h-3 text-poe-gold-dim shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 15l-2 5L9 9l11 4-5 2z" />
            </svg>
            <span className="text-poe-gold-mid truncate">{selectedNodeTitle}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard hints */}
      <div className="text-[9px] text-poe-text-dim font-mono hidden lg:flex items-center gap-2 opacity-40">
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">Del</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^D</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^S</kbd>
      </div>
    </div>
  );
}
