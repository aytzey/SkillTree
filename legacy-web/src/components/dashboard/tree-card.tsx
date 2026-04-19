"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface TreeCardProps {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
  progress: number;
  updatedAt: string;
  isPublic: boolean;
  highlight?: boolean;
}

export function TreeCard({ id, title, description, nodeCount, progress, updatedAt, isPublic, highlight = false }: TreeCardProps) {
  const timeAgo = getTimeAgo(new Date(updatedAt));
  const isComplete = progress === 100;
  const completedSteps = Math.max(0, Math.min(nodeCount, Math.round((nodeCount * progress) / 100)));

  return (
    <Link href={`/tree/${id}`}>
      <motion.div
        whileHover={{ y: -4, boxShadow: "0 8px 40px rgba(196,148,26,0.12)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`relative border rounded-lg p-5 cursor-pointer transition-colors group overflow-hidden ${highlight ? "border-poe-gold-mid shadow-[0_0_0_1px_rgba(196,148,26,0.22),0_24px_60px_rgba(0,0,0,0.25)]" : "border-poe-border-dim hover:border-poe-gold-dim"}`}
        style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-poe-gold-dim/30 to-transparent" />

        {highlight && (
          <span className="absolute right-4 top-4 rounded-full border border-poe-gold-mid/30 bg-poe-gold-mid/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-poe-gold-bright font-mono">
            Continue
          </span>
        )}

        <div className="flex items-start justify-between mb-3">
          <h3 className="font-cinzel text-base font-semibold text-poe-text-primary group-hover:text-poe-gold-bright transition truncate">
            {title}
          </h3>
          {isPublic && (
            <span className="text-[10px] font-mono uppercase tracking-wider bg-poe-complete-green/10 text-poe-complete-bright border border-poe-complete-green/20 px-2 py-0.5 rounded ml-2 shrink-0">
              Public
            </span>
          )}
        </div>

        {description && (
          <p className="text-xs text-poe-text-dim mb-3 line-clamp-2 leading-relaxed">{description}</p>
        )}

        <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim uppercase tracking-wide mb-4">
          <span>{nodeCount} steps</span>
          <span>{timeAgo}</span>
        </div>

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-cinzel text-poe-text-primary leading-none">{progress}%</div>
            <div className="text-[11px] text-poe-text-dim mt-1">{completedSteps} of {nodeCount} steps done</div>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-poe-border-dim text-poe-text-dim group-hover:border-poe-gold-dim group-hover:text-poe-gold-bright transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        <div className="h-1 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isComplete
                ? "linear-gradient(90deg, #0d9668, #34d399)"
                : "linear-gradient(90deg, #8b6914, #e8b828)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div className="text-right text-[10px] font-mono text-poe-text-dim mt-1.5">
          {isComplete ? (
            <span className="text-poe-complete-bright">Complete</span>
          ) : (
            "Open roadmap"
          )}
        </div>
      </motion.div>
    </Link>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
