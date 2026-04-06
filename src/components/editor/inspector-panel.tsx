"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeProgressFromSubtasks } from "@/lib/status-engine";
import type { SkillNodeData, NodeStatus, SubTask, Resource, EdgeType } from "@/types";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface InspectorPanelProps {
  node: SkillNodeData | null;
  selectedEdge: { id: string; type: string } | null;
  onUpdateEdgeType: (edgeId: string, type: string) => void;
  onUpdate: (node: SkillNodeData) => Promise<void>;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onAddNode: () => void;
  onAiEnhance: (nodeId: string | null) => void;
  onAiSuggest: (nodeId: string, direction: "above" | "below" | "parallel") => void;
  aiEnhancing: boolean;
  canEdit: boolean;
  isReadOnly: boolean;
  // New props for connections
  allNodes: SkillNodeData[];
  allEdges: { id: string; sourceNodeId: string; targetNodeId: string; type: string }[];
  onAddNodeWithEdge: (direction: "above" | "below", anchorNodeId: string, edgeType: EdgeType) => void;
  onLinkExistingNode: (direction: "above" | "below", anchorNodeId: string, targetNodeId: string, edgeType: EdgeType) => void;
  onDeleteEdge: (edgeId: string) => void;
  onStartPickMode: (direction: "above" | "below", anchorNodeId: string) => void;
  pickModeActive: boolean;
}

const statusOptions: { value: NodeStatus; label: string; color: string }[] = [
  { value: "locked", label: "Blocked", color: "border-poe-locked-mid text-poe-locked-mid" },
  { value: "available", label: "Open", color: "border-poe-gold-mid text-poe-gold-bright" },
  { value: "in_progress", label: "In Progress", color: "border-poe-progress-blue text-poe-progress-blue" },
  { value: "completed", label: "Done", color: "border-poe-complete-green text-poe-complete-bright" },
];

function SectionHeader({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <>
      <div className="poe-section-divider my-4" />
      <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-3 flex items-center gap-2">
        {icon && <span className="text-poe-gold-dim">{icon}</span>}
        {children}
      </h4>
    </>
  );
}

function EmptyState({
  onAddNode,
  canCreate,
}: {
  onAddNode: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-full border border-poe-border-dim flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-poe-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      </div>
      <p className="text-sm text-poe-text-secondary mb-1">No step selected</p>
      <p className="text-xs text-poe-text-dim mb-5">Click a step on the canvas to inspect it</p>
      {canCreate ? (
        <button
          onClick={onAddNode}
          className="poe-btn px-4 py-2 text-xs"
        >
          + Create New Step
        </button>
      ) : (
        <p className="text-[11px] text-poe-text-dim max-w-[180px]">
          Read-only mode is active. Select a step to inspect its details.
        </p>
      )}
    </div>
  );
}

const edgeTypeChoices: { value: EdgeType; label: string; color: string; dot: string }[] = [
  { value: "prerequisite", label: "Prerequisite", color: "text-poe-gold-bright border-poe-gold-mid", dot: "bg-poe-gold-mid" },
  { value: "recommended", label: "Recommended", color: "text-poe-energy-blue border-poe-energy-blue", dot: "bg-poe-energy-blue" },
  { value: "optional", label: "Optional", color: "text-poe-text-dim border-poe-border-mid", dot: "bg-poe-text-dim" },
];

function ConnectionsSection({
  node,
  allNodes,
  allEdges,
  disabled,
  onAddNodeWithEdge,
  onLinkExistingNode,
  onDeleteEdge,
  onStartPickMode,
  pickModeActive,
}: {
  node: SkillNodeData;
  allNodes: SkillNodeData[];
  allEdges: { id: string; sourceNodeId: string; targetNodeId: string; type: string }[];
  disabled: boolean;
  onAddNodeWithEdge: (direction: "above" | "below", anchorNodeId: string, edgeType: EdgeType) => void;
  onLinkExistingNode: (direction: "above" | "below", anchorNodeId: string, targetNodeId: string, edgeType: EdgeType) => void;
  onDeleteEdge: (edgeId: string) => void;
  onStartPickMode: (direction: "above" | "below", anchorNodeId: string) => void;
  pickModeActive: boolean;
}) {
  const [linkDropdown, setLinkDropdown] = useState<{ direction: "above" | "below"; search: string } | null>(null);
  const [edgeTypePopup, setEdgeTypePopup] = useState<{
    direction: "above" | "below";
    targetNodeId?: string;
    mode: "new" | "link";
  } | null>(null);

  // Above = edges where this node is the TARGET (sourceNodeId points to prerequisites)
  const aboveEdges = allEdges.filter((e) => e.targetNodeId === node.id);
  // Below = edges where this node is the SOURCE (targetNodeId points to what this leads to)
  const belowEdges = allEdges.filter((e) => e.sourceNodeId === node.id);

  const connectedNodeIds = new Set<string>([
    node.id,
    ...aboveEdges.map((e) => e.sourceNodeId),
    ...belowEdges.map((e) => e.targetNodeId),
  ]);

  const availableNodes = allNodes.filter((n) => !connectedNodeIds.has(n.id));
  const filteredNodes = linkDropdown
    ? availableNodes.filter((n) =>
        n.title.toLowerCase().includes(linkDropdown.search.toLowerCase())
      )
    : [];

  function getNodeTitle(nodeId: string) {
    return allNodes.find((n) => n.id === nodeId)?.title || "Unknown";
  }

  function getDotClass(type: string) {
    const choice = edgeTypeChoices.find((c) => c.value === type);
    return choice?.dot || "bg-poe-text-dim";
  }

  function handleSelectNodeFromDropdown(targetNodeId: string) {
    if (!linkDropdown) return;
    setEdgeTypePopup({ direction: linkDropdown.direction, targetNodeId, mode: "link" });
    setLinkDropdown(null);
  }

  function handleAddNew(direction: "above" | "below") {
    setEdgeTypePopup({ direction, mode: "new" });
    setLinkDropdown(null);
  }

  function handleEdgeTypeSelect(edgeType: EdgeType) {
    if (!edgeTypePopup) return;
    if (edgeTypePopup.mode === "new") {
      onAddNodeWithEdge(edgeTypePopup.direction, node.id, edgeType);
    } else if (edgeTypePopup.mode === "link" && edgeTypePopup.targetNodeId) {
      onLinkExistingNode(edgeTypePopup.direction, node.id, edgeTypePopup.targetNodeId, edgeType);
    }
    setEdgeTypePopup(null);
  }

  function handlePickOnCanvas(direction: "above" | "below") {
    onStartPickMode(direction, node.id);
    setLinkDropdown(null);
  }

  function renderDirection(direction: "above" | "below") {
    const edges = direction === "above" ? aboveEdges : belowEdges;
    const label = direction === "above" ? "Required By (Prerequisites)" : "Unlocks (Leads To)";

    return (
      <div className="mb-3">
        <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-1.5">
          {label}
        </div>

        {/* Connected edges list */}
        <div className="space-y-1 mb-2">
          {edges.length === 0 ? (
            <div className="text-xs text-poe-text-dim italic">None</div>
          ) : (
            edges.map((edge) => {
              const connectedId = direction === "above" ? edge.sourceNodeId : edge.targetNodeId;
              return (
                <div key={edge.id} className="flex items-center gap-2 group">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotClass(edge.type)}`} />
                  <span className="text-xs text-poe-text-secondary flex-1 truncate">
                    {getNodeTitle(connectedId)}
                  </span>
                  {!disabled && (
                    <button
                      onClick={() => onDeleteEdge(edge.id)}
                      className="text-poe-danger text-xs opacity-0 group-hover:opacity-100 transition"
                      title="Remove connection"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Action buttons */}
        {!disabled && (
          <div className="flex gap-1.5">
            <button
              onClick={() => handleAddNew(direction)}
              className="poe-btn px-2 py-1 text-[10px] flex-1"
            >
              + Add {direction === "above" ? "Requirement" : "Dependent"}
            </button>
            <button
              onClick={() =>
                setLinkDropdown(
                  linkDropdown?.direction === direction
                    ? null
                    : { direction, search: "" }
                )
              }
              className="poe-btn px-2 py-1 text-[10px] flex-1"
            >
              🔗 Link Existing
            </button>
          </div>
        )}

        {/* Link existing dropdown */}
        {linkDropdown?.direction === direction && (
          <div className="mt-2 border border-poe-border-dim rounded bg-poe-panel p-2 space-y-2">
            <input
              value={linkDropdown.search}
              onChange={(e) => setLinkDropdown({ ...linkDropdown, search: e.target.value })}
              placeholder="Search nodes..."
              className="poe-input w-full px-2 py-1 text-xs"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto poe-scrollbar space-y-0.5">
              {filteredNodes.length === 0 ? (
                <div className="text-[10px] text-poe-text-dim italic px-1 py-1">
                  No available nodes
                </div>
              ) : (
                filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleSelectNodeFromDropdown(n.id)}
                    className="w-full text-left px-2 py-1.5 text-xs text-poe-text-secondary hover:bg-white/5 rounded transition truncate"
                  >
                    {n.title}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => handlePickOnCanvas(direction)}
              className="w-full poe-btn px-2 py-1 text-[10px]"
            >
              🎯 Pick on Canvas
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Pick mode indicator */}
      {pickModeActive && (
        <div className="mb-3 px-2 py-1.5 rounded border border-poe-energy-blue/50 bg-poe-energy-blue/10 text-[10px] text-poe-energy-blue text-center font-mono">
          Click a node on the canvas to connect…
        </div>
      )}

      {renderDirection("above")}
      {renderDirection("below")}

      {/* Edge type popup overlay */}
      {edgeTypePopup && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded">
          <div className="bg-poe-panel border border-poe-border-dim rounded p-3 w-full mx-2">
            <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-2 text-center">
              Connection Type
            </div>
            <div className="flex flex-col gap-1.5">
              {edgeTypeChoices.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleEdgeTypeSelect(opt.value)}
                  className={`px-3 py-2 rounded border text-left transition ${opt.color} hover:bg-white/5`}
                >
                  <div className="text-xs font-mono uppercase">{opt.label}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setEdgeTypePopup(null)}
              className="w-full mt-2 text-[10px] text-poe-text-dim hover:text-poe-text-secondary transition text-center py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InspectorPanel({
  node,
  selectedEdge,
  onUpdateEdgeType,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddNode,
  onAiEnhance,
  onAiSuggest,
  aiEnhancing,
  canEdit,
  isReadOnly,
  allNodes,
  allEdges,
  onAddNodeWithEdge,
  onLinkExistingNode,
  onDeleteEdge,
  onStartPickMode,
  pickModeActive,
}: InspectorPanelProps) {
  const [status, setStatus] = useState<NodeStatus>("available");
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
  const [descExpanded, setDescExpanded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedNodeIdRef = useRef<string | null>(null);
  const inputsDisabled = !canEdit || isReadOnly;

  useEffect(() => {
    if (!node) return;
    loadedNodeIdRef.current = node.id;
    setTitle(node.title);
    setDescription(node.description || "");
    setDifficulty(node.difficulty);
    setEstimatedHours(node.estimatedHours?.toString() || "");
    setProgress(node.progress);
    setSubTasks(node.subTasks);
    setResources(node.resources);
    setNotes(node.notes || "");
    setStatus(node.status);
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!node || loadedNodeIdRef.current !== node.id || inputsDisabled) return;

    const currentData = JSON.stringify({
      title, description, difficulty, estimatedHours, progress, status,
      subTasks, resources, notes,
    });
    const originalData = JSON.stringify({
      title: node.title,
      description: node.description || "",
      difficulty: node.difficulty,
      estimatedHours: node.estimatedHours?.toString() || "",
      progress: node.progress,
      status: node.status,
      subTasks: node.subTasks,
      resources: node.resources,
      notes: node.notes || "",
    });

    if (currentData === originalData) return;

    setSaveState("unsaved");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await onUpdate({
          ...node,
          title,
          description: description || null,
          difficulty,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
          progress,
          status,
          subTasks,
          resources,
          notes: notes || null,
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("failed");
      }
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, difficulty, estimatedHours, progress, status, subTasks, resources, notes, node, inputsDisabled, onUpdate]);

  // --- Manual save (instant) ---
  async function saveNow() {
    if (!node || inputsDisabled) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    try {
      await onUpdate({
        ...node,
        title,
        description: description || null,
        difficulty,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        progress,
        status,
        subTasks,
        resources,
        notes: notes || null,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("failed");
    }
  }

  // --- Subtask handlers with progress sync ---
  function toggleSubTask(index: number) {
    if (inputsDisabled) return;
    const updated = subTasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
    setSubTasks(updated);
    const computed = computeProgressFromSubtasks(updated);
    if (computed >= 0) setProgress(computed);
  }

  function addSubTask() {
    if (inputsDisabled) return;
    if (!newSubTask.trim()) return;
    const updated = [...subTasks, { title: newSubTask.trim(), done: false }];
    setSubTasks(updated);
    setNewSubTask("");
    const computed = computeProgressFromSubtasks(updated);
    if (computed >= 0) setProgress(computed);
  }

  function removeSubTask(index: number) {
    if (inputsDisabled) return;
    const updated = subTasks.filter((_, i) => i !== index);
    setSubTasks(updated);
    const computed = computeProgressFromSubtasks(updated);
    if (computed >= 0) setProgress(computed);
  }

  function addResource() {
    if (inputsDisabled) return;
    if (!newResTitle.trim() || !newResUrl.trim()) return;
    setResources([...resources, { title: newResTitle.trim(), url: newResUrl.trim() }]);
    setNewResTitle("");
    setNewResUrl("");
  }

  function removeResource(index: number) {
    if (inputsDisabled) return;
    setResources(resources.filter((_, i) => i !== index));
  }

  // --- Edge editor view ---
  if (!node && selectedEdge) {
    const edgeTypeOptions = [
      { value: "prerequisite", label: "Prerequisite", desc: "Must complete first", color: "text-poe-gold-bright border-poe-gold-mid" },
      { value: "recommended", label: "Recommended", desc: "Suggested path", color: "text-poe-energy-blue border-poe-energy-blue" },
      { value: "optional", label: "Optional", desc: "Nice to have", color: "text-poe-text-dim border-poe-border-mid" },
    ];

    return (
      <div className="poe-inspector w-80 h-full flex flex-col">
        <div className="px-4 py-3 border-b border-poe-border-dim">
          <h3 className="text-sm font-cinzel font-semibold text-poe-gold-bright uppercase tracking-wider">
            Edge
          </h3>
        </div>
        <div className="p-4">
          <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wide">Connection Type</label>
          <div className="flex flex-col gap-1.5">
            {edgeTypeOptions.map((opt) => (
              <button
                key={opt.value}
                  onClick={() => !inputsDisabled && onUpdateEdgeType(selectedEdge.id, opt.value)}
                  disabled={inputsDisabled}
                  className={`px-3 py-2.5 rounded border text-left transition ${
                    selectedEdge.type === opt.value
                      ? `${opt.color} bg-white/5`
                      : "border-poe-border-dim text-poe-text-dim hover:border-poe-border-mid"
                } ${inputsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="text-xs font-mono uppercase">{opt.label}</div>
                <div className="text-[10px] text-poe-text-dim mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (!node) {
    return (
      <div className="poe-inspector w-80 h-full flex flex-col">
        <div className="px-4 py-3 border-b border-poe-border-dim">
          <h3 className="text-sm font-cinzel font-semibold text-poe-text-dim uppercase tracking-wider">
            Inspector
          </h3>
        </div>
        <div className="flex-1">
          <EmptyState onAddNode={onAddNode} canCreate={canEdit && !isReadOnly} />
        </div>
      </div>
    );
  }

  // --- Node inspector ---
  return (
    <div className="poe-inspector w-80 h-full flex flex-col">
      <div className="px-4 py-3 border-b border-poe-border-dim flex items-center justify-between">
        <h3 className="text-sm font-cinzel font-semibold text-poe-gold-bright uppercase tracking-wider">
          Step
        </h3>
        <div className={`text-[10px] font-mono transition-colors ${
          saveState === "saving" ? "text-poe-progress-blue" :
          saveState === "saved" ? "text-poe-complete-bright" :
          saveState === "failed" ? "text-poe-danger" :
          saveState === "unsaved" ? "text-poe-gold-mid" :
          "text-poe-text-dim"
        }`}>
          {saveState === "saving" ? "saving..." :
           saveState === "saved" ? "saved" :
           saveState === "failed" ? "failed" :
           saveState === "unsaved" ? "unsaved" :
           ""}
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
            {/* Step Section */}
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-3 flex items-center gap-2">
              <span className="text-poe-gold-dim">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              Step
            </h4>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={inputsDisabled}
                className="poe-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="flex items-center justify-between text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
                <span>Description</span>
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className="text-poe-text-dim hover:text-poe-gold-mid transition"
                  title={descExpanded ? "Collapse" : "Expand"}
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${descExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={descExpanded ? 10 : 2}
                disabled={inputsDisabled}
                className={`poe-input w-full px-3 py-2 text-sm resize-none transition-all duration-200 ${
                  !descExpanded ? "overflow-hidden" : "overflow-y-auto poe-scrollbar"
                }`}
              />
            </div>

            <div className="mb-1">
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wide">Status</label>
              <div className="flex gap-1">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => !inputsDisabled && setStatus(opt.value)}
                    disabled={inputsDisabled}
                    className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition ${
                      status === opt.value
                        ? `${opt.color} bg-white/5`
                        : "border-poe-border-dim text-poe-text-dim hover:border-poe-border-mid"
                    } ${inputsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progression Section */}
            <SectionHeader icon={
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            }>Effort</SectionHeader>

            <div className="mb-3">
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wide">Effort Level</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => !inputsDisabled && setDifficulty(level)}
                    disabled={inputsDisabled}
                    className={`w-6 h-6 rounded border text-xs font-mono transition ${
                      level <= difficulty
                        ? "bg-poe-gold-mid/20 border-poe-gold-mid text-poe-gold-bright"
                        : "bg-transparent border-poe-border-dim text-poe-text-dim"
                    } ${inputsDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
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
                onChange={(e) => setEstimatedHours(e.target.value)}
                min="0"
                step="0.5"
                disabled={inputsDisabled}
                className="poe-input w-full px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>

            <div className="mb-1">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
                Progress: <span className="text-poe-text-secondary">{progress}%</span>
                {subTasks.length > 0 && (
                  <span className="text-poe-text-dim ml-1">(auto)</span>
                )}
              </label>
              <input
                type="range"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                min="0"
                max="100"
                disabled={inputsDisabled || subTasks.length > 0}
                className={`w-full accent-poe-gold-mid ${
                  inputsDisabled || subTasks.length > 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {/* Content Section */}
            <SectionHeader icon={
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }>Requirements</SectionHeader>

            <div className="mb-4">
              <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wide">
                Checklist
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
                      disabled={inputsDisabled}
                      className="accent-poe-complete-green"
                    />
                    <span className={`text-xs flex-1 ${task.done ? "text-poe-text-dim line-through" : "text-poe-text-primary"}`}>
                      {task.title}
                    </span>
                    <button
                      onClick={() => removeSubTask(i)}
                      disabled={inputsDisabled}
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
                  placeholder="New checklist item..."
                  disabled={inputsDisabled}
                  className="poe-input flex-1 px-2 py-1 text-xs"
                />
                <button onClick={addSubTask} disabled={inputsDisabled} className="poe-btn px-2 py-1 text-xs disabled:opacity-50">
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
                      disabled={inputsDisabled}
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
                  disabled={inputsDisabled}
                  className="poe-input w-full px-2 py-1 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="URL..."
                    disabled={inputsDisabled}
                    className="poe-input flex-1 px-2 py-1 text-xs"
                  />
                  <button onClick={addResource} disabled={inputsDisabled} className="poe-btn px-2 py-1 text-xs disabled:opacity-50">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Freeform notes..."
                disabled={inputsDisabled}
                className="poe-input w-full px-3 py-2 text-sm resize-none"
              />
            </div>

            {/* Connections Section */}
            <SectionHeader icon={
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            }>Dependencies</SectionHeader>

            <ConnectionsSection
              node={node}
              allNodes={allNodes}
              allEdges={allEdges}
              disabled={inputsDisabled}
              onAddNodeWithEdge={onAddNodeWithEdge}
              onLinkExistingNode={onLinkExistingNode}
              onDeleteEdge={onDeleteEdge}
              onStartPickMode={onStartPickMode}
              pickModeActive={pickModeActive}
            />

            {/* Actions Section */}
            <SectionHeader icon={
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            }>Actions</SectionHeader>

            <div className="space-y-2">
              {!inputsDisabled ? (
                <>
                  <button
                    onClick={saveNow}
                    disabled={saveState === "saving"}
                    className={`w-full py-2 text-sm font-semibold rounded-md transition ${
                      saveState === "saving"
                        ? "poe-btn text-poe-progress-blue border-poe-progress-blue"
                        : saveState === "saved"
                        ? "poe-btn text-poe-complete-bright border-poe-complete-green bg-poe-complete-green/10"
                        : saveState === "unsaved"
                        ? "poe-btn-gold poe-btn"
                        : "poe-btn opacity-60"
                    }`}
                  >
                    {saveState === "saving" ? "Saving..." :
                     saveState === "saved" ? "Saved" :
                     saveState === "failed" ? "Retry Save" :
                     saveState === "unsaved" ? "Save Changes" :
                     "No Changes"}
                  </button>

                  <button
                    onClick={() => onAiEnhance(node.id)}
                    disabled={aiEnhancing}
                    className="w-full py-2 text-sm font-semibold rounded-md transition poe-btn"
                    style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
                  >
                    {aiEnhancing ? "Working..." : "AI Enhance This Step"}
                  </button>

                  <div>
                    <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-1.5 mt-2">
                      AI Suggest Step
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onAiSuggest(node.id, "above")}
                        disabled={aiEnhancing}
                        className="flex-1 py-2 text-[11px] font-mono rounded-md transition poe-btn disabled:opacity-40 flex flex-col items-center gap-0.5"
                        style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        <span>Above</span>
                      </button>
                      <button
                        onClick={() => onAiSuggest(node.id, "below")}
                        disabled={aiEnhancing}
                        className="flex-1 py-2 text-[11px] font-mono rounded-md transition poe-btn disabled:opacity-40 flex flex-col items-center gap-0.5"
                        style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                        <span>Below</span>
                      </button>
                      <button
                        onClick={() => onAiSuggest(node.id, "parallel")}
                        disabled={aiEnhancing}
                        className="flex-1 py-2 text-[11px] font-mono rounded-md transition poe-btn disabled:opacity-40 flex flex-col items-center gap-0.5"
                        style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <span>Parallel</span>
                      </button>
                    </div>
                  </div>

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
                </>
              ) : (
                <div className="rounded-md border border-poe-border-dim bg-poe-panel-hover/30 px-3 py-2 text-xs text-poe-text-dim">
                  Read-only mode is active. Switch back to edit mode to change this step.
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
