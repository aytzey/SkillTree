"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SkillNodeData, SubTask, Resource } from "@/types";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface InspectorPanelProps {
  node: SkillNodeData | null;
  onUpdate: (node: SkillNodeData) => Promise<void>;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onAddNode: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="poe-section-divider my-4" />
      <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-3">
        {children}
      </h4>
    </>
  );
}

function EmptyState({ onAddNode }: { onAddNode: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-full border border-poe-border-dim flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-poe-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      </div>
      <p className="text-sm text-poe-text-secondary mb-1">No node selected</p>
      <p className="text-xs text-poe-text-dim mb-5">Click a node on the canvas to inspect it</p>
      <button
        onClick={onAddNode}
        className="poe-btn px-4 py-2 text-xs"
      >
        + Create New Node
      </button>
    </div>
  );
}

export function InspectorPanel({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddNode,
}: InspectorPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [progress, setProgress] = useState(0);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [notes, setNotes] = useState("");
  const [newSubTask, setNewSubTask] = useState("");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResUrl, setNewResUrl] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setDescription(node.description || "");
    setDifficulty(node.difficulty);
    setEstimatedHours(node.estimatedHours?.toString() || "");
    setProgress(node.progress);
    setSubTasks(node.subTasks);
    setResources(node.resources);
    setNotes(node.notes || "");
    setSaveState("idle");
    setDirty(false);
  }, [node?.id]);

  function markDirty() {
    setDirty(true);
    setSaveState("unsaved");
  }

  async function save() {
    if (!node) return;
    setSaveState("saving");
    try {
      await onUpdate({
        ...node,
        title,
        description: description || null,
        difficulty,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        progress,
        subTasks,
        resources,
        notes: notes || null,
      });
      setSaveState("saved");
      setDirty(false);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("failed");
    }
  }

  function toggleSubTask(index: number) {
    setSubTasks(subTasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
    markDirty();
  }

  function addSubTask() {
    if (!newSubTask.trim()) return;
    setSubTasks([...subTasks, { title: newSubTask.trim(), done: false }]);
    setNewSubTask("");
    markDirty();
  }

  function removeSubTask(index: number) {
    setSubTasks(subTasks.filter((_, i) => i !== index));
    markDirty();
  }

  function addResource() {
    if (!newResTitle.trim() || !newResUrl.trim()) return;
    setResources([...resources, { title: newResTitle.trim(), url: newResUrl.trim() }]);
    setNewResTitle("");
    setNewResUrl("");
    markDirty();
  }

  function removeResource(index: number) {
    setResources(resources.filter((_, i) => i !== index));
    markDirty();
  }

  if (!node) {
    return (
      <div className="poe-inspector w-80 h-full flex flex-col">
        <div className="px-4 py-3 border-b border-poe-border-dim">
          <h3 className="text-sm font-cinzel font-semibold text-poe-text-dim uppercase tracking-wider">
            Codex
          </h3>
        </div>
        <div className="flex-1">
          <EmptyState onAddNode={onAddNode} />
        </div>
      </div>
    );
  }

  return (
    <div className="poe-inspector w-80 h-full flex flex-col">
      <div className="px-4 py-3 border-b border-poe-border-dim flex items-center justify-between">
        <h3 className="text-sm font-cinzel font-semibold text-poe-gold-bright uppercase tracking-wider">
          Codex
        </h3>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-[10px] text-poe-gold-mid font-mono">unsaved</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto poe-scrollbar p-4 space-y-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-3">
              Identity
            </h4>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                className="poe-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                rows={2}
                className="poe-input w-full px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="text-xs text-poe-text-secondary">
              Status: <span className="font-mono text-poe-gold-mid">{node.status.replace("_", " ")}</span>
            </div>

            <SectionHeader>Progression</SectionHeader>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wide">Difficulty</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => { setDifficulty(level); markDirty(); }}
                    className={`w-6 h-6 rounded border text-xs font-mono transition ${
                      level <= difficulty
                        ? "bg-poe-gold-mid/20 border-poe-gold-mid text-poe-gold-bright"
                        : "bg-transparent border-poe-border-dim text-poe-text-dim"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
                Est. Hours
              </label>
              <input
                type="number"
                value={estimatedHours}
                onChange={(e) => { setEstimatedHours(e.target.value); markDirty(); }}
                min="0"
                step="0.5"
                className="poe-input w-full px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>

            <div className="mb-1">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
                Progress: <span className="text-poe-text-secondary">{progress}%</span>
              </label>
              <input
                type="range"
                value={progress}
                onChange={(e) => { setProgress(parseInt(e.target.value)); markDirty(); }}
                min="0"
                max="100"
                className="w-full accent-poe-gold-mid"
              />
            </div>

            <SectionHeader>Content</SectionHeader>

            <div className="mb-4">
              <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wide">
                Sub-tasks
                <span className="text-poe-text-secondary ml-1">
                  ({subTasks.filter((t) => t.done).length}/{subTasks.length})
                </span>
              </label>
              <div className="space-y-1">
                {subTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleSubTask(i)}
                      className="accent-poe-complete-green"
                    />
                    <span className={`text-xs flex-1 ${task.done ? "text-poe-text-dim line-through" : "text-poe-text-primary"}`}>
                      {task.title}
                    </span>
                    <button
                      onClick={() => removeSubTask(i)}
                      className="text-poe-danger text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubTask()}
                  placeholder="New sub-task..."
                  className="poe-input flex-1 px-2 py-1 text-xs"
                />
                <button onClick={addSubTask} className="poe-btn px-2 py-1 text-xs">
                  Add
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wide">Resources</label>
              <div className="space-y-1">
                {resources.map((res, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-poe-energy-blue hover:text-poe-energy-purple flex-1 truncate transition"
                    >
                      {res.title}
                    </a>
                    <button
                      onClick={() => removeResource(i)}
                      className="text-poe-danger text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-1 mt-2">
                <input
                  value={newResTitle}
                  onChange={(e) => setNewResTitle(e.target.value)}
                  placeholder="Title..."
                  className="poe-input w-full px-2 py-1 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="URL..."
                    className="poe-input flex-1 px-2 py-1 text-xs"
                  />
                  <button onClick={addResource} className="poe-btn px-2 py-1 text-xs">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); markDirty(); }}
                rows={3}
                placeholder="Freeform notes..."
                className="poe-input w-full px-3 py-2 text-sm resize-none"
              />
            </div>

            <SectionHeader>Actions</SectionHeader>

            <div className="space-y-2">
              <button
                onClick={save}
                disabled={!dirty || saveState === "saving"}
                className={`w-full py-2 text-sm font-semibold rounded-md transition ${
                  dirty
                    ? "poe-btn-gold poe-btn"
                    : "poe-btn opacity-50 cursor-not-allowed"
                }`}
              >
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "saved"
                  ? "Saved"
                  : saveState === "failed"
                  ? "Retry Save"
                  : dirty
                  ? "Save Changes"
                  : "No Changes"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => onDuplicate(node.id)}
                  className="poe-btn flex-1 py-1.5 text-xs"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => onDelete(node.id)}
                  className="poe-btn-danger poe-btn flex-1 py-1.5 text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
