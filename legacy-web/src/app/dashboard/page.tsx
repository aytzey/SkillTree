"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { TreeCard } from "@/components/dashboard/tree-card";
import {
  ROADMAP_MICROCOPY,
  ROADMAP_PRIMARY_CTA_COPY,
  ROADMAP_SECTION_LABELS,
} from "@/lib/copy-constants";

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
  const [query, setQuery] = useState("");

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

  const sortedTrees = useMemo(
    () => [...trees].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [trees]
  );

  const filteredTrees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedTrees;

    return sortedTrees.filter((tree) => {
      const haystack = `${tree.title} ${tree.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, sortedTrees]);

  const continueTree = sortedTrees.find((tree) => tree.progress < 100) ?? sortedTrees[0] ?? null;

  return (
    <div className="min-h-screen bg-poe-void">
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
              + {ROADMAP_PRIMARY_CTA_COPY.dashboard}
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
          {ROADMAP_SECTION_LABELS.dashboardTitle}
        </motion.h1>
        <p className="text-sm text-poe-text-dim mb-6">{ROADMAP_MICROCOPY.dashboardSubtitle}</p>

        {!loading && continueTree && !query.trim() && (
          <div className="mb-6 rounded-2xl border border-[rgba(196,148,26,0.18)] bg-[rgba(18,18,38,0.78)] px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-poe-gold-mid mb-2">Continue</p>
              <h2 className="font-cinzel text-xl text-poe-text-primary">{continueTree.title}</h2>
              <p className="text-sm text-poe-text-dim mt-1">
                Pick up where you left off instead of hunting through the grid.
              </p>
            </div>
            <Link href={`/tree/${continueTree.id}`} className="poe-btn-gold poe-btn px-5 py-2 text-sm font-semibold whitespace-nowrap">
              Resume latest roadmap
            </Link>
          </div>
        )}

        {!loading && trees.length > 0 && (
          <div className="mb-6">
            <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wider font-mono">
              Find a roadmap
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or description"
              className="poe-input w-full md:max-w-md px-4 py-3 text-sm"
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="relative border border-poe-border-dim rounded-lg p-5 overflow-hidden"
                style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
                <div className="h-5 w-2/3 rounded bg-white/8 mb-4" />
                <div className="h-4 w-full rounded bg-white/6 mb-2" />
                <div className="h-4 w-5/6 rounded bg-white/6 mb-6" />
                <div className="h-10 w-full rounded bg-white/6" />
              </div>
            ))}
          </div>
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
            <p className="text-poe-text-secondary text-lg mb-2 font-cinzel">{ROADMAP_SECTION_LABELS.dashboardEmptyTitle}</p>
            <p className="text-poe-text-dim text-sm mb-8">{ROADMAP_MICROCOPY.dashboardEmptyBody}</p>
            <button
              onClick={() => router.push("/tree/new")}
              className="poe-btn-gold poe-btn px-8 py-3 font-cinzel font-semibold tracking-wider"
            >
              {ROADMAP_PRIMARY_CTA_COPY.dashboardEmpty}
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTrees.map((tree, i) => (
              <motion.div
                key={tree.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, ease: "easeOut" }}
              >
                <TreeCard {...tree} highlight={continueTree?.id === tree.id} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
