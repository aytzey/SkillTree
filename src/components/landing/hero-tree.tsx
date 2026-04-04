"use client";

import { motion } from "framer-motion";

const demoNodes = [
  { id: 1, title: "Basics", x: 250, y: 40, status: "completed" as const },
  { id: 2, title: "Core Skills", x: 120, y: 160, status: "completed" as const },
  { id: 3, title: "Advanced", x: 380, y: 160, status: "in_progress" as const },
  { id: 4, title: "Specialization", x: 60, y: 280, status: "available" as const },
  { id: 5, title: "Expert Path", x: 250, y: 280, status: "locked" as const },
  { id: 6, title: "Mastery", x: 440, y: 280, status: "locked" as const },
];

const demoEdges = [
  { from: 1, to: 2 }, { from: 1, to: 3 },
  { from: 2, to: 4 }, { from: 2, to: 5 },
  { from: 3, to: 5 }, { from: 3, to: 6 },
];

const statusColors = {
  completed: { bg: "rgba(16,185,129,0.15)", border: "#10b981", glow: "0 0 20px rgba(16,185,129,0.4)" },
  in_progress: { bg: "rgba(99,102,241,0.15)", border: "#6366f1", glow: "0 0 20px rgba(99,102,241,0.4)" },
  available: { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", glow: "0 0 20px rgba(245,158,11,0.3)" },
  locked: { bg: "rgba(71,85,105,0.1)", border: "#475569", glow: "none" },
};

export function HeroTree() {
  return (
    <div className="relative w-[540px] h-[360px] mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 540 360">
        {demoEdges.map((edge, i) => {
          const from = demoNodes.find((n) => n.id === edge.from)!;
          const to = demoNodes.find((n) => n.id === edge.to)!;
          return (
            <motion.line key={i}
              x1={from.x + 40} y1={from.y + 30} x2={to.x + 40} y2={to.y + 30}
              stroke="#818cf8" strokeWidth="2" strokeOpacity="0.4"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
            />
          );
        })}
      </svg>
      {demoNodes.map((node, i) => {
        const colors = statusColors[node.status];
        return (
          <motion.div key={node.id}
            className="absolute rounded-xl border-2 px-4 py-2 text-center min-w-[80px]"
            style={{ left: node.x, top: node.y, backgroundColor: colors.bg, borderColor: colors.border, boxShadow: colors.glow, opacity: node.status === "locked" ? 0.4 : 1 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: node.status === "locked" ? 0.4 : 1 }}
            transition={{ duration: 0.4, delay: i * 0.12, type: "spring" }}
          >
            <span className="text-sm font-medium text-white">{node.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
