"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-rpg-gold mb-8 text-center">New Skill Tree</h1>

      <div className="mb-6">
        <label className="block text-sm text-rpg-gold mb-1">Tree Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Rust Programming"
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>

      {!mode && (
        <div className="grid grid-cols-2 gap-4">
          <motion.button whileHover={{ scale: 1.02 }} onClick={() => setMode("ai")}
            className="bg-rpg-card border border-rpg-blue rounded-xl p-6 text-center hover:border-rpg-blue/80 transition">
            <div className="text-3xl mb-2">{"\u{1F916}"}</div>
            <div className="text-white font-semibold mb-1">AI Generate</div>
            <div className="text-xs text-slate-400">Enter a topic, AI creates the tree</div>
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} onClick={() => setMode("blank")}
            className="bg-rpg-card border border-rpg-border rounded-xl p-6 text-center hover:border-rpg-gold transition">
            <div className="text-3xl mb-2">{"\u{1F4DD}"}</div>
            <div className="text-white font-semibold mb-1">Blank Canvas</div>
            <div className="text-xs text-slate-400">Start from scratch</div>
          </motion.button>
        </div>
      )}

      {mode === "ai" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <label className="block text-sm text-rpg-gold mb-1">Topic</label>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what the skill tree should cover..." rows={3}
              className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold transition resize-none" />
          </div>
          <div>
            <label className="block text-sm text-rpg-gold mb-1">Your Current Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setMode(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Back</button>
            <button onClick={handleCreate} disabled={loading || !title.trim()}
              className="flex-1 bg-rpg-blue/20 border border-rpg-blue text-rpg-blue rounded-lg py-3 font-medium hover:bg-rpg-blue/30 transition disabled:opacity-50">
              {loading ? "Generating..." : "Generate with AI"}
            </button>
          </div>
        </motion.div>
      )}

      {mode === "blank" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
          <button onClick={() => setMode(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Back</button>
          <button onClick={handleCreate} disabled={loading || !title.trim()}
            className="flex-1 bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-3 font-medium hover:bg-rpg-gold/30 transition disabled:opacity-50">
            {loading ? "Creating..." : "Create Blank Tree"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
