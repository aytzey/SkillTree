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
}

export function TreeCard({ id, title, description, nodeCount, progress, updatedAt, isPublic }: TreeCardProps) {
  const timeAgo = getTimeAgo(new Date(updatedAt));
  const isComplete = progress === 100;

  return (
    <Link href={`/tree/${id}`}>
      <motion.div
        whileHover={{ y: -4, boxShadow: "0 8px 40px rgba(196,148,26,0.12)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative border border-poe-border-dim rounded-lg p-5 cursor-pointer transition-colors hover:border-poe-gold-dim group overflow-hidden"
        style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
      >
        {/* Subtle top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-poe-gold-dim/30 to-transparent" />

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
          <span>{nodeCount} nodes</span>
          <span>{timeAgo}</span>
        </div>

        {/* Progress bar */}
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
            `${progress}%`
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
