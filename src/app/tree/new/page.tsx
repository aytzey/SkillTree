"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function NewTreePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "blank" | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);

    const treeRes = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const tree = await treeRes.json();

    if (mode === "ai" && topic.trim()) {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: tree.id, topic, level }),
      });
      if (!genRes.ok) console.error("AI generation failed");
    }

    router.push(`/tree/${tree.id}`);
  }

  return (
    <div className="min-h-screen bg-poe-void">
      {/* Header */}
      <div className="poe-header">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-between px-6 max-w-6xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-3">
            <svg className="w-5 h-5 text-poe-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-cinzel text-lg font-bold text-poe-gold-bright tracking-wider">SKILLTREE</span>
          </Link>
        </div>
        <div className="poe-ornate-border" />
      </div>

      <div className="max-w-lg mx-auto px-6 py-16">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-cinzel text-3xl font-bold text-poe-text-primary mb-2 text-center"
        >
          New Roadmap
        </motion.h1>
        <p className="text-sm text-poe-text-dim text-center mb-10">Define your goal and we'll map the steps to get there</p>

        {/* Title input */}
        <div className="mb-8">
          <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
            Goal
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Learn Rust Programming"
            className="poe-input w-full px-4 py-3 text-sm"
          />
        </div>

        {/* Mode selection */}
        {!mode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            <button
              onClick={() => setMode("ai")}
              className="border border-poe-border-dim rounded-lg p-6 text-center transition hover:border-poe-energy-blue group"
              style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
            >
              <div className="w-12 h-12 rounded-full border border-poe-energy-blue/30 flex items-center justify-center mx-auto mb-3 group-hover:border-poe-energy-blue/60 transition">
                <svg className="w-5 h-5 text-poe-energy-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div className="font-cinzel text-sm font-semibold text-poe-text-primary mb-1">AI Generate</div>
              <div className="text-[10px] text-poe-text-dim">Describe your goal, AI builds the roadmap</div>
            </button>

            <button
              onClick={() => setMode("blank")}
              className="border border-poe-border-dim rounded-lg p-6 text-center transition hover:border-poe-gold-dim group"
              style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
            >
              <div className="w-12 h-12 rounded-full border border-poe-gold-dim/30 flex items-center justify-center mx-auto mb-3 group-hover:border-poe-gold-dim/60 transition">
                <svg className="w-5 h-5 text-poe-gold-mid" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="font-cinzel text-sm font-semibold text-poe-text-primary mb-1">Blank Canvas</div>
              <div className="text-[10px] text-poe-text-dim">Start from scratch</div>
            </button>
          </motion.div>
        )}

        {/* AI mode */}
        {mode === "ai" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div>
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">Describe Your Goal</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to achieve? e.g., Build production-ready Rust web services from scratch"
                rows={3}
                className="poe-input w-full px-4 py-3 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">Your Current Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="poe-input w-full px-4 py-3 text-sm"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setMode(null)} className="poe-btn px-4 py-2 text-sm">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !title.trim()}
                className="flex-1 poe-btn py-3 font-cinzel font-semibold tracking-wider disabled:opacity-50"
                style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
              >
                {loading ? "Building roadmap..." : "Generate Roadmap"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Blank mode */}
        {mode === "blank" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pt-2">
            <button onClick={() => setMode(null)} className="poe-btn px-4 py-2 text-sm">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="flex-1 poe-btn-gold poe-btn py-3 font-cinzel font-semibold tracking-wider disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Blank Roadmap"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
