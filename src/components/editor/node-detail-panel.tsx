"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SkillNodeData, SubTask, Resource } from "@/types";

interface NodeDetailPanelProps {
  node: SkillNodeData;
  onUpdate: (node: SkillNodeData) => void;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onUpdate, onClose }: NodeDetailPanelProps) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || "");
  const [difficulty, setDifficulty] = useState(node.difficulty);
  const [estimatedHours, setEstimatedHours] = useState(node.estimatedHours?.toString() || "");
  const [progress, setProgress] = useState(node.progress);
  const [subTasks, setSubTasks] = useState<SubTask[]>(node.subTasks);
  const [resources, setResources] = useState<Resource[]>(node.resources);
  const [notes, setNotes] = useState(node.notes || "");
  const [newSubTask, setNewSubTask] = useState("");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResUrl, setNewResUrl] = useState("");

  function save() {
    onUpdate({
      ...node, title, description: description || null, difficulty,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      progress, subTasks, resources, notes: notes || null,
    });
  }

  function toggleSubTask(index: number) {
    setSubTasks(subTasks.map((t, i) => i === index ? { ...t, done: !t.done } : t));
  }

  function addSubTask() {
    if (!newSubTask.trim()) return;
    setSubTasks([...subTasks, { title: newSubTask.trim(), done: false }]);
    setNewSubTask("");
  }

  function removeSubTask(index: number) {
    setSubTasks(subTasks.filter((_, i) => i !== index));
  }

  function addResource() {
    if (!newResTitle.trim() || !newResUrl.trim()) return;
    setResources([...resources, { title: newResTitle.trim(), url: newResUrl.trim() }]);
    setNewResTitle("");
    setNewResUrl("");
  }

  function removeResource(index: number) {
    setResources(resources.filter((_, i) => i !== index));
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
        className="absolute top-0 right-0 w-80 h-full bg-rpg-bg-secondary border-l border-rpg-border overflow-y-auto z-30"
      >
        <div className="p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-rpg-gold">Node Details</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold resize-none" />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setDifficulty(star)}
                  className={`text-lg ${star <= difficulty ? "text-rpg-gold" : "text-slate-600"}`}>
                  {"\u2B50"}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Estimated Hours</label>
            <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} min="0" step="0.5"
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold" />
          </div>

          {/* Progress */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Progress: {progress}%</label>
            <input type="range" value={progress} onChange={(e) => setProgress(parseInt(e.target.value))} min="0" max="100" className="w-full accent-rpg-gold" />
          </div>

          {/* Sub-tasks */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Sub-tasks ({subTasks.filter((t) => t.done).length}/{subTasks.length})</label>
            <div className="space-y-1.5">
              {subTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={task.done} onChange={() => toggleSubTask(i)} className="accent-rpg-green" />
                  <span className={`text-sm flex-1 ${task.done ? "text-slate-500 line-through" : "text-white"}`}>{task.title}</span>
                  <button onClick={() => removeSubTask(i)} className="text-red-400 text-xs opacity-0 group-hover:opacity-100">&times;</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={newSubTask} onChange={(e) => setNewSubTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubTask()} placeholder="New sub-task..."
                className="flex-1 bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold" />
              <button onClick={addSubTask} className="text-xs text-rpg-gold hover:underline">Add</button>
            </div>
          </div>

          {/* Resources */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Resources</label>
            <div className="space-y-1.5">
              {resources.map((res, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-sm text-rpg-neon hover:underline flex-1 truncate">{res.title}</a>
                  <button onClick={() => removeResource(i)} className="text-red-400 text-xs opacity-0 group-hover:opacity-100">&times;</button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 mt-2">
              <input value={newResTitle} onChange={(e) => setNewResTitle(e.target.value)} placeholder="Title..."
                className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold" />
              <div className="flex gap-2">
                <input value={newResUrl} onChange={(e) => setNewResUrl(e.target.value)} placeholder="URL..."
                  className="flex-1 bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold" />
                <button onClick={addResource} className="text-xs text-rpg-gold hover:underline">Add</button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Freeform notes..."
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold resize-none" />
          </div>

          {/* Save */}
          <button onClick={save} className="w-full bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-2 text-sm font-medium hover:bg-rpg-gold/30 transition">
            Save Changes
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
