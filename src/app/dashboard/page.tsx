"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { TreeCard } from "@/components/dashboard/tree-card";

interface TreeSummary {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
  progress: number;
  updatedAt: string;
  isPublic: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trees")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return [];
        }
        return r.json();
      })
      .then((data) => { setTrees(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-poe-void">
      {/* Header bar */}
      <div className="poe-header">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-between px-6 max-w-6xl mx-auto">
          <Link href="/" className="font-cinzel text-lg font-bold text-poe-gold-bright tracking-wider">
            SKILLTREE
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/tree/new")}
              className="poe-btn-gold poe-btn px-4 py-1.5 text-sm font-semibold"
            >
              + New Roadmap
            </button>
          </div>
        </div>
        <div className="poe-ornate-border" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-cinzel text-3xl font-bold text-poe-text-primary mb-2"
        >
          Your Roadmaps
        </motion.h1>
        <p className="text-sm text-poe-text-dim mb-10">Your goals, broken down into clear steps and requirements.</p>

        {loading ? (
          <div className="text-center text-poe-text-dim py-20 font-mono text-sm">Loading...</div>
        ) : trees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-24"
          >
            <div className="w-24 h-24 rounded-full border border-poe-border-dim flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-poe-gold-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-poe-text-secondary text-lg mb-2 font-cinzel">No roadmaps yet</p>
            <p className="text-poe-text-dim text-sm mb-8">Pick a goal and build your first step-by-step roadmap</p>
            <button
              onClick={() => router.push("/tree/new")}
              className="poe-btn-gold poe-btn px-8 py-3 font-cinzel font-semibold tracking-wider"
            >
              Create Your First Roadmap
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {trees.map((tree, i) => (
              <motion.div
                key={tree.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, ease: "easeOut" }}
              >
                <TreeCard {...tree} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
