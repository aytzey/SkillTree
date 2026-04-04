"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      .then((r) => r.json())
      .then((data) => { setTrees(data); setLoading(false); });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-rpg-gold">My Skill Trees</h1>
        <button
          onClick={() => router.push("/tree/new")}
          className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-4 py-2 text-sm font-medium hover:bg-rpg-gold/30 transition"
        >
          + New Tree
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20">Loading...</div>
      ) : trees.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
          <p className="text-slate-400 text-lg mb-4">No skill trees yet</p>
          <button
            onClick={() => router.push("/tree/new")}
            className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-6 py-3 font-medium hover:bg-rpg-gold/30 transition"
          >
            Create Your First Tree
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trees.map((tree, i) => (
            <motion.div key={tree.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <TreeCard {...tree} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
