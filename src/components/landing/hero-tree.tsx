"use client";

import { motion } from "framer-motion";

const demoNodes = [
  { id: 1, title: "Basics", x: 280, y: 30, status: "completed" as const },
  { id: 2, title: "Core Skills", x: 130, y: 170, status: "completed" as const },
  { id: 3, title: "Advanced", x: 430, y: 170, status: "in_progress" as const },
  { id: 4, title: "Specialization", x: 50, y: 310, status: "available" as const },
  { id: 5, title: "Expert Path", x: 280, y: 310, status: "locked" as const },
  { id: 6, title: "Mastery", x: 510, y: 310, status: "locked" as const },
];

const demoEdges = [
  { from: 1, to: 2 }, { from: 1, to: 3 },
  { from: 2, to: 4 }, { from: 2, to: 5 },
  { from: 3, to: 5 }, { from: 3, to: 6 },
];

const statusStyles = {
  completed: {
    bg: "rgba(16,185,129,0.12)",
    border: "#10b981",
    glow: "0 0 20px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.1), inset 0 0 15px rgba(16,185,129,0.05)",
    textColor: "#a7f3d0",
  },
  in_progress: {
    bg: "rgba(99,102,241,0.12)",
    border: "#818cf8",
    glow: "0 0 20px rgba(129,140,248,0.35), 0 0 40px rgba(129,140,248,0.1), inset 0 0 15px rgba(129,140,248,0.05)",
    textColor: "#c7d2fe",
  },
  available: {
    bg: "rgba(212,147,10,0.1)",
    border: "#d4930a",
    glow: "0 0 20px rgba(212,147,10,0.35), 0 0 40px rgba(212,147,10,0.1), inset 0 0 15px rgba(212,147,10,0.05)",
    textColor: "#fde68a",
  },
  locked: {
    bg: "rgba(71,85,105,0.06)",
    border: "#334155",
    glow: "none",
    textColor: "#64748b",
  },
};

export function HeroTree() {
  return (
    <div className="relative w-[640px] h-[400px] mx-auto">
      {/* SVG edges */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 640 400">
        <defs>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(212,147,10,0.5)" />
            <stop offset="100%" stopColor="rgba(129,140,248,0.2)" />
          </linearGradient>
        </defs>
        {demoEdges.map((edge, i) => {
          const from = demoNodes.find((n) => n.id === edge.from)!;
          const to = demoNodes.find((n) => n.id === edge.to)!;
          const x1 = from.x + 45;
          const y1 = from.y + 25;
          const x2 = to.x + 45;
          const y2 = to.y + 25;
          const midY = (y1 + y2) / 2;
          return (
            <motion.path
              key={i}
              d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
              fill="none"
              stroke="url(#edgeGrad)"
              strokeWidth="1.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.3 + i * 0.12, ease: "easeOut" }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {demoNodes.map((node, i) => {
        const s = statusStyles[node.status];
        return (
          <motion.div
            key={node.id}
            className="absolute px-5 py-2.5 text-center min-w-[90px] border font-[family-name:var(--font-cinzel)] text-sm font-semibold tracking-wide"
            style={{
              left: node.x,
              top: node.y,
              backgroundColor: s.bg,
              borderColor: s.border,
              boxShadow: s.glow,
              color: s.textColor,
              clipPath: "polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)",
              opacity: node.status === "locked" ? 0.35 : 1,
            }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: node.status === "locked" ? 0.35 : 1 }}
            transition={{ duration: 0.5, delay: 0.6 + i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
          >
            {node.title}
          </motion.div>
        );
      })}
    </div>
  );
}
