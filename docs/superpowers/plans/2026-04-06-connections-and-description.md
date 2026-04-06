# Expandable Description & Connection Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expandable description field in inspector panel, and a Connections section with "Add Above/Below" (new node) and "Link Existing" (dropdown search + canvas pick mode) with edge type selection.

**Architecture:** All changes are in the editor UI layer (inspector-panel.tsx, skill-tree-editor.tsx). New callbacks propagate from InspectorPanel → EditorInner for node creation + edge creation. A small `ConnectionsSection` component handles the connections UI. Canvas pick mode uses a state flag in EditorInner that intercepts onNodeClick.

**Tech Stack:** React, ReactFlow, TypeScript, Tailwind CSS (PoE theme)

---

### Task 1: Expandable Description Field

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx:348-357`

- [ ] **Step 1: Add description expanded state and update the textarea**

In `InspectorPanel`, add a `descExpanded` state toggle. Replace the current 2-row textarea with a collapsible version:

```tsx
// Add to state declarations (after line 102)
const [descExpanded, setDescExpanded] = useState(false);
```

Replace the description block (lines 348-357) with:

```tsx
<div className="mb-3">
  <label className="flex items-center justify-between text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
    <span>Description</span>
    {description && (
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
    )}
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
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Open a tree, select a node, check the description field has the chevron toggle and expand/collapse works.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: expandable description field in inspector panel"
```

---

### Task 2: Add Connection Callbacks to InspectorPanel Props

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx:10-23`

- [ ] **Step 1: Extend InspectorPanelProps interface**

Add the new callbacks needed for the connections section:

```tsx
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
```

Also add `EdgeType` to the import from `@/types`:

```tsx
import type { SkillNodeData, NodeStatus, SubTask, Resource, EdgeType } from "@/types";
```

- [ ] **Step 2: Destructure the new props in the component**

Update the destructuring in the `InspectorPanel` function signature to include all new props:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: add connection callback props to InspectorPanel"
```

---

### Task 3: Build ConnectionsSection Component

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx` (add component before InspectorPanel)

- [ ] **Step 1: Add the ConnectionsSection component**

Add this component inside `inspector-panel.tsx`, after the `EmptyState` component and before the `InspectorPanel` component:

```tsx
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

  // Edges where this node is the TARGET (above = prerequisites flowing into this node)
  const aboveEdges = allEdges.filter((e) => e.targetNodeId === node.id);
  // Edges where this node is the SOURCE (below = this node leads to others)
  const belowEdges = allEdges.filter((e) => e.sourceNodeId === node.id);

  const getNodeTitle = (id: string) =>
    allNodes.find((n) => n.id === id)?.title ?? "Unknown";

  // Nodes already connected to this node (to exclude from link search)
  const connectedNodeIds = new Set([
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

  const edgeTypeOptions: { value: EdgeType; label: string; color: string }[] = [
    { value: "prerequisite", label: "Prerequisite", color: "text-poe-gold-bright border-poe-gold-mid" },
    { value: "recommended", label: "Recommended", color: "text-poe-energy-blue border-poe-energy-blue" },
    { value: "optional", label: "Optional", color: "text-poe-text-dim border-poe-border-mid" },
  ];

  function handleEdgeTypeSelect(edgeType: EdgeType) {
    if (!edgeTypePopup) return;
    if (edgeTypePopup.mode === "new") {
      onAddNodeWithEdge(edgeTypePopup.direction, node.id, edgeType);
    } else if (edgeTypePopup.targetNodeId) {
      onLinkExistingNode(edgeTypePopup.direction, node.id, edgeTypePopup.targetNodeId, edgeType);
    }
    setEdgeTypePopup(null);
    setLinkDropdown(null);
  }

  function handlePickOnCanvas(direction: "above" | "below") {
    setLinkDropdown(null);
    onStartPickMode(direction, node.id);
  }

  function renderEdgeList(
    edgeList: typeof aboveEdges,
    getLinkedNodeId: (e: typeof aboveEdges[0]) => string,
    label: string,
    direction: "above" | "below"
  ) {
    return (
      <div className="mb-3">
        <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-1.5">
          {label}
        </div>

        {edgeList.length > 0 ? (
          <div className="space-y-1 mb-2">
            {edgeList.map((edge) => {
              const linkedId = getLinkedNodeId(edge);
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-1.5 group px-2 py-1.5 rounded border border-poe-border-dim bg-poe-panel-hover/20"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      edge.type === "prerequisite"
                        ? "bg-poe-gold-mid"
                        : edge.type === "recommended"
                        ? "bg-poe-energy-blue"
                        : "bg-poe-text-dim"
                    }`}
                  />
                  <span className="text-xs text-poe-text-secondary truncate flex-1">
                    {getNodeTitle(linkedId)}
                  </span>
                  {!disabled && (
                    <button
                      onClick={() => onDeleteEdge(edge.id)}
                      className="text-poe-danger text-[10px] opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title="Remove connection"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] text-poe-text-dim italic mb-2 px-2">None</div>
        )}

        {!disabled && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setEdgeTypePopup({ direction, mode: "new" })}
              className="poe-btn px-2 py-1 text-[10px] flex-1"
            >
              + Add {direction === "above" ? "Above" : "Below"}
            </button>
            <button
              onClick={() =>
                linkDropdown?.direction === direction
                  ? setLinkDropdown(null)
                  : setLinkDropdown({ direction, search: "" })
              }
              className={`poe-btn px-2 py-1 text-[10px] flex-1 ${
                linkDropdown?.direction === direction ? "border-poe-gold-mid text-poe-gold-bright" : ""
              }`}
            >
              🔗 Link Existing
            </button>
          </div>
        )}

        {/* Link Existing Dropdown */}
        {linkDropdown?.direction === direction && (
          <div className="mt-2 border border-poe-border-mid rounded-md bg-poe-panel p-2 space-y-2">
            <input
              value={linkDropdown.search}
              onChange={(e) => setLinkDropdown({ ...linkDropdown, search: e.target.value })}
              placeholder="Search nodes..."
              className="poe-input w-full px-2 py-1 text-xs"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto poe-scrollbar space-y-0.5">
              {filteredNodes.length > 0 ? (
                filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setEdgeTypePopup({ direction, targetNodeId: n.id, mode: "link" })}
                    className="w-full text-left px-2 py-1.5 text-xs text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition truncate"
                  >
                    {n.title}
                  </button>
                ))
              ) : (
                <div className="text-[10px] text-poe-text-dim italic px-2 py-1">
                  {availableNodes.length === 0 ? "All nodes connected" : "No match"}
                </div>
              )}
            </div>
            <button
              onClick={() => handlePickOnCanvas(direction)}
              className="w-full poe-btn px-2 py-1.5 text-[10px] border-dashed"
            >
              🎯 Pick on Canvas
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {renderEdgeList(aboveEdges, (e) => e.sourceNodeId, "Above (Prerequisites)", "above")}
      {renderEdgeList(belowEdges, (e) => e.targetNodeId, "Below (Leads to)", "below")}

      {/* Pick mode indicator */}
      {pickModeActive && (
        <div className="mt-2 px-2 py-1.5 rounded border border-poe-gold-mid/50 bg-poe-gold-mid/10 text-[10px] text-poe-gold-bright text-center">
          Click a node on the canvas to connect…
        </div>
      )}

      {/* Edge Type Selection Popup */}
      {edgeTypePopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEdgeTypePopup(null)} />
          <div className="relative z-50 mt-2 border border-poe-border-mid rounded-md bg-poe-panel p-2 space-y-1">
            <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-1">
              Connection Type
            </div>
            {edgeTypeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleEdgeTypeSelect(opt.value)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded border transition ${opt.color} hover:bg-white/5`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: add ConnectionsSection component to inspector panel"
```

---

### Task 4: Wire ConnectionsSection into InspectorPanel Render

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx`

- [ ] **Step 1: Add Connections section between Content and Actions sections**

Insert a new section in the node inspector render, between the Content section (after the Notes textarea `</div>` around line 551) and the Actions section header:

```tsx
            {/* Connections Section */}
            <SectionHeader icon={
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            }>Connections</SectionHeader>

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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: wire ConnectionsSection into inspector panel render"
```

---

### Task 5: Add Connection Handlers in EditorInner

**Files:**
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Add pick mode state**

Add after the `aiEnhancing` state declaration (around line 135):

```tsx
const [pickMode, setPickMode] = useState<{
  direction: "above" | "below";
  anchorNodeId: string;
} | null>(null);
```

- [ ] **Step 2: Add handleAddNodeWithEdge callback**

Add after `handleAiSuggest` (around line 867):

```tsx
  const handleAddNodeWithEdge = useCallback(
    async (direction: "above" | "below", anchorNodeId: string, edgeType: EdgeType) => {
      if (!effectiveCanEdit) return;

      const snapshot = getCurrentTreeSnapshot();
      const nextPosition = findAvailableNodePosition(snapshot.nodes, {
        anchorNodeId,
        direction,
      });

      const response = await fetch(`/api/trees/${tree.id}/nodes`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          title: "New Skill",
          positionX: nextPosition.x,
          positionY: nextPosition.y,
        }),
      });

      const newNode = await response.json();
      if (!response.ok) throw new Error("Failed to create node");

      treeDataRef.current.nodes.push(newNode);
      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: newNode.id,
          type: "skillNode",
          position: { x: newNode.positionX, y: newNode.positionY },
          data: {
            title: newNode.title,
            status: newNode.status,
            difficulty: newNode.difficulty,
            progress: newNode.progress,
            description: newNode.description,
            selected: false,
          },
        },
      ]);

      // Create edge: above means new → anchor, below means anchor → new
      const sourceId = direction === "above" ? newNode.id : anchorNodeId;
      const targetId = direction === "above" ? anchorNodeId : newNode.id;

      const edgeResponse = await fetch(`/api/trees/${tree.id}/edges`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: edgeType,
        }),
      });

      const savedEdge = await edgeResponse.json();
      if (edgeResponse.ok) {
        treeDataRef.current.edges.push(savedEdge);
        setEdges((currentEdges) => [
          ...currentEdges,
          {
            id: savedEdge.id,
            source: savedEdge.sourceNodeId,
            target: savedEdge.targetNodeId,
            type: "skillEdge",
            data: { type: savedEdge.type },
          },
        ]);
      }

      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, getCurrentTreeSnapshot, recomputeStatuses, setEdges, setNodes, tree.id]
  );
```

- [ ] **Step 3: Add handleLinkExistingNode callback**

Add right after `handleAddNodeWithEdge`:

```tsx
  const handleLinkExistingNode = useCallback(
    async (direction: "above" | "below", anchorNodeId: string, targetNodeId: string, edgeType: EdgeType) => {
      if (!effectiveCanEdit) return;

      const sourceId = direction === "above" ? targetNodeId : anchorNodeId;
      const targetId = direction === "above" ? anchorNodeId : targetNodeId;

      const response = await fetch(`/api/trees/${tree.id}/edges`, {
        method: "POST",
        headers: buildRequestHeaders(true),
        body: JSON.stringify({
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: edgeType,
        }),
      });

      const savedEdge = await response.json();
      if (!response.ok) throw new Error("Failed to link nodes");

      treeDataRef.current.edges.push(savedEdge);
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: savedEdge.id,
          source: savedEdge.sourceNodeId,
          target: savedEdge.targetNodeId,
          type: "skillEdge",
          data: { type: savedEdge.type },
        },
      ]);

      setPickMode(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, setEdges, tree.id]
  );
```

- [ ] **Step 4: Add handleDeleteEdge callback**

Add right after `handleLinkExistingNode`:

```tsx
  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!effectiveCanEdit) return;

      await fetch(`/api/trees/${tree.id}/edges/${edgeId}`, {
        method: "DELETE",
        headers: buildRequestHeaders(),
      });

      treeDataRef.current.edges = treeDataRef.current.edges.filter((e) => e.id !== edgeId);
      setEdges((currentEdges) => currentEdges.filter((e) => e.id !== edgeId));

      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
      recomputeStatuses();
    },
    [buildRequestHeaders, effectiveCanEdit, recomputeStatuses, selectedEdgeId, setEdges, tree.id]
  );
```

- [ ] **Step 5: Add EdgeType import**

Update the import from `@/types`:

```tsx
import type {
  SkillTreeData,
  SkillNodeData,
  NodeStatus,
  ShareMode,
  EdgeType,
} from "@/types";
```

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx
git commit -m "feat: add connection handler callbacks in EditorInner"
```

---

### Task 6: Wire Pick Mode into Canvas onNodeClick

**Files:**
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Add edge type popup state for pick mode**

Add after the `pickMode` state:

```tsx
const [pickEdgeTypePopup, setPickEdgeTypePopup] = useState<{
  direction: "above" | "below";
  anchorNodeId: string;
  targetNodeId: string;
} | null>(null);
```

- [ ] **Step 2: Modify onNodeClick to intercept pick mode**

Replace the current `onNodeClick` callback:

```tsx
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (pickMode) {
      // In pick mode: show edge type popup for the picked node
      if (node.id !== pickMode.anchorNodeId) {
        setPickEdgeTypePopup({
          direction: pickMode.direction,
          anchorNodeId: pickMode.anchorNodeId,
          targetNodeId: node.id,
        });
      }
      setPickMode(null);
      return;
    }
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [pickMode]);
```

- [ ] **Step 3: Modify onPaneClick to cancel pick mode**

Replace the current `onPaneClick`:

```tsx
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
    setPickMode(null);
    setPickEdgeTypePopup(null);
  }, []);
```

- [ ] **Step 4: Add pick mode edge type popup and banner to the JSX**

Add after the `ContextMenu` render (around line 1004), inside the `<div className="flex-1 relative">`:

```tsx
          {/* Pick mode banner */}
          {pickMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-md border border-poe-gold-mid/60 bg-poe-obsidian/95 text-sm text-poe-gold-bright font-mono flex items-center gap-3 shadow-lg">
              <span>Click a node to connect</span>
              <button
                onClick={() => setPickMode(null)}
                className="text-poe-text-dim hover:text-poe-danger text-xs transition"
              >
                ESC
              </button>
            </div>
          )}

          {/* Pick mode edge type popup */}
          {pickEdgeTypePopup && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickEdgeTypePopup(null)} />
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border border-poe-border-mid rounded-md p-3 min-w-[200px]"
                style={{
                  background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
                }}
              >
                <div className="text-[10px] text-poe-text-dim uppercase tracking-wide font-mono mb-2">
                  Connection Type
                </div>
                {[
                  { value: "prerequisite" as EdgeType, label: "Prerequisite", color: "text-poe-gold-bright border-poe-gold-mid" },
                  { value: "recommended" as EdgeType, label: "Recommended", color: "text-poe-energy-blue border-poe-energy-blue" },
                  { value: "optional" as EdgeType, label: "Optional", color: "text-poe-text-dim border-poe-border-mid" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      void handleLinkExistingNode(
                        pickEdgeTypePopup.direction,
                        pickEdgeTypePopup.anchorNodeId,
                        pickEdgeTypePopup.targetNodeId,
                        opt.value
                      );
                      setPickEdgeTypePopup(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded border transition mb-1 ${opt.color} hover:bg-white/5`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
```

- [ ] **Step 5: Add ESC key handler for pick mode**

In the `shortcutActions` useMemo, update `onDeselect`:

```tsx
      onDeselect: () => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setContextMenu(null);
        setPickMode(null);
        setPickEdgeTypePopup(null);
      },
```

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx
git commit -m "feat: wire pick mode into canvas node click with edge type selection"
```

---

### Task 7: Pass New Props to InspectorPanel

**Files:**
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Update InspectorPanel JSX props**

Replace the `<InspectorPanel` block (around line 1007) with:

```tsx
        <InspectorPanel
          node={selectedNode}
          selectedEdge={
            selectedEdgeId
              ? {
                  id: selectedEdgeId,
                  type:
                    ((edges.find((edge) => edge.id === selectedEdgeId)?.data as {
                      type?: string;
                    })?.type ?? "prerequisite"),
                }
              : null
          }
          onUpdateEdgeType={(edgeId, type) => {
            void handleUpdateEdgeType(edgeId, type);
          }}
          onUpdate={handleUpdateNode}
          onDelete={(nodeId) => {
            void handleDeleteNode(nodeId);
          }}
          onDuplicate={(nodeId) => {
            void handleDuplicateNode(nodeId);
          }}
          onAddNode={() => {
            void handleAddNode();
          }}
          onAiEnhance={(nodeId) => {
            void handleAiEnhance(nodeId);
          }}
          onAiSuggest={(nodeId, direction) => {
            void handleAiSuggest(nodeId, direction);
          }}
          aiEnhancing={aiEnhancing}
          canEdit={canEdit}
          isReadOnly={isReadOnly}
          allNodes={treeDataRef.current.nodes}
          allEdges={treeDataRef.current.edges}
          onAddNodeWithEdge={(direction, anchorNodeId, edgeType) => {
            void handleAddNodeWithEdge(direction, anchorNodeId, edgeType);
          }}
          onLinkExistingNode={(direction, anchorNodeId, targetNodeId, edgeType) => {
            void handleLinkExistingNode(direction, anchorNodeId, targetNodeId, edgeType);
          }}
          onDeleteEdge={(edgeId) => {
            void handleDeleteEdge(edgeId);
          }}
          onStartPickMode={(direction, anchorNodeId) => {
            setPickMode({ direction, anchorNodeId });
          }}
          pickModeActive={!!pickMode}
        />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx
git commit -m "feat: pass connection props to InspectorPanel"
```

---

### Task 8: Verify & Fix Build

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (warnings OK)

- [ ] **Step 3: Fix any issues found**

Address any TypeScript or lint errors.

- [ ] **Step 4: Test in browser**

Run: `npm run dev`

Verify:
1. Description field expands/collapses with chevron toggle
2. Connections section shows Above and Below lists
3. "Add Above" creates a new node above with an edge (after selecting edge type)
4. "Add Below" creates a new node below with an edge (after selecting edge type)
5. "Link Existing" shows dropdown with search filtering
6. "Pick on Canvas" enters pick mode with banner, clicking a node shows edge type popup
7. Edge type popup shows 3 options (prerequisite/recommended/optional)
8. [x] button removes edges
9. ESC cancels pick mode
10. Multiple above/below connections work

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues for connections feature"
```
