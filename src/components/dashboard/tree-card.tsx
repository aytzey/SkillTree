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

  return (
    <Link href={`/tree/${id}`}>
      <motion.div
        whileHover={{ scale: 1.02, borderColor: "rgba(245, 158, 11, 0.5)" }}
        className="bg-rpg-card border border-rpg-border rounded-xl p-5 cursor-pointer transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
          {isPublic && (
            <span className="text-xs bg-rpg-green/20 text-rpg-green px-2 py-0.5 rounded-full ml-2 shrink-0">Public</span>
          )}
        </div>
        {description && <p className="text-sm text-slate-400 mb-3 line-clamp-2">{description}</p>}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{nodeCount} nodes</span>
          <span>{timeAgo}</span>
        </div>
        <div className="mt-3 h-1.5 bg-rpg-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progress === 100 ? "var(--glow-green)" : "linear-gradient(90deg, var(--glow-blue), var(--glow-gold))",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="text-right text-xs text-slate-500 mt-1">{progress}%</div>
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
