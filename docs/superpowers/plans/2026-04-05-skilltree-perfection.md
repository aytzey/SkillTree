# SkillTree Perfection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken status indicators, make the editor intuitive with auto-save and keyboard shortcuts, and elevate the visual quality to PoE-level polish.

**Architecture:** Three-phase approach. Phase 1 fixes the broken status engine integration and auto-save. Phase 2 adds UX features (keyboard shortcuts, smart placement, edge editing, tooltips). Phase 3 elevates visuals with node size tiers, enhanced glows, canvas atmosphere, and animated edges. All changes are in the frontend — no schema changes needed.

**Tech Stack:** Next.js 14, React 18, @xyflow/react 12, Tailwind CSS 3, Framer Motion 12, TypeScript 5

---

## File Map

### Phase 1 — Critical Fixes
- Modify: `src/components/editor/skill-tree-editor.tsx` — integrate status engine, add auto-save debounce, wire onNodesChange for dirty tracking
- Modify: `src/lib/status-engine.ts` — add subtask↔progress sync to `computeIntrinsicStatus`
- Modify: `src/components/editor/inspector-panel.tsx` — remove manual save button, add auto-save via debounced callback, sync subtask progress
- Modify: `src/components/editor/world-header.tsx` — simplify to position-only save

### Phase 2 — UX Improvements
- Create: `src/lib/use-keyboard-shortcuts.ts` — keyboard shortcut hook
- Modify: `src/components/editor/skill-tree-editor.tsx` — integrate shortcuts, smart node placement, edge click handling, edge saving on connect
- Modify: `src/components/editor/context-menu.tsx` — add status change, zoom-to-node actions
- Modify: `src/components/editor/skill-node.tsx` — add tooltip on hover
- Modify: `src/components/editor/inspector-panel.tsx` — add edge type section
- Create: `src/app/api/trees/[id]/edges/[edgeId]/route.ts` — add PUT handler for edge type update (currently only DELETE exists)

### Phase 3 — Visual Polish
- Modify: `src/components/editor/skill-node.tsx` — node size tiers (keystone/notable/small), status icons, enhanced glow effects
- Modify: `src/components/editor/skill-edge.tsx` — animated energy dots, enhanced glow
- Modify: `src/app/globals.css` — canvas atmosphere, nebula gradients, enhanced animations, node tier styles
- Modify: `tailwind.config.ts` — new animation keyframes
- Modify: `src/components/editor/inspector-panel.tsx` — section icons, visual polish
- Modify: `src/components/editor/journey-status-bar.tsx` — visual enrichment

---

## Phase 1: Critical Fixes

### Task 1: Integrate Status Engine into Editor

**Files:**
- Modify: `src/components/editor/skill-tree-editor.tsx`
- Modify: `src/lib/status-engine.ts`

- [ ] **Step 1: Update status-engine to export a helper that also syncs subtask progress**

In `src/lib/status-engine.ts`, update `computeIntrinsicStatus` to also compute progress from subtasks, and export a new helper:

```typescript
// Add at end of src/lib/status-engine.ts

export function computeProgressFromSubtasks(subTasks: SubTask[]): number {
  if (subTasks.length === 0) return -1; // -1 means "no subtasks, keep manual progress"
  const done = subTasks.filter((t) => t.done).length;
  return Math.round((done / subTasks.length) * 100);
}
```

- [ ] **Step 2: Import and call status engine in skill-tree-editor.tsx**

In `src/components/editor/skill-tree-editor.tsx`, add the import and a `recomputeStatuses` function that runs after any node/edge mutation:

Add import at top:
```typescript
import { computeNodeStatuses } from "@/lib/status-engine";
```

Add this function inside `EditorInner`, after the existing state declarations:

```typescript
const recomputeStatuses = useCallback(() => {
  const currentNodes = treeDataRef.current.nodes;
  const currentEdges = treeDataRef.current.edges;
  const statusMap = computeNodeStatuses(currentNodes, currentEdges);

  // Update treeDataRef with new statuses
  treeDataRef.current.nodes = currentNodes.map((n) => ({
    ...n,
    status: statusMap.get(n.id) ?? n.status,
  }));

  // Update flow nodes
  setNodes((nds) =>
    nds.map((n) => {
      const newStatus = statusMap.get(n.id);
      if (!newStatus) return n;
      return {
        ...n,
        data: { ...n.data, status: newStatus },
      };
    })
  );
}, [setNodes]);
```

- [ ] **Step 3: Call recomputeStatuses after every mutation**

In `skill-tree-editor.tsx`, add `recomputeStatuses()` calls at the end of:
- `handleUpdateNode` — after `setNodes(...)` call
- `handleDeleteNode` — after `setEdges(...)` call
- `handleAddNode` — after `setSelectedNodeId(node.id)`
- `handleDuplicateNode` — after `setSelectedNodeId(node.id)`
- `onConnect` — after `setEdges(...)` call

For `onConnect`, also persist the edge to the backend. Replace the existing `onConnect` with:

```typescript
const onConnect = useCallback(
  async (connection: Connection) => {
    const newEdge = {
      ...connection,
      type: "skillEdge",
      data: { type: "prerequisite" },
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // Persist edge to backend
    try {
      const res = await fetch(`/api/trees/${tree.id}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          type: "prerequisite",
        }),
      });
      const savedEdge = await res.json();
      // Update the edge with the real ID from backend
      setEdges((eds) =>
        eds.map((e) =>
          e.source === connection.source && e.target === connection.target && !e.id.startsWith("cl")
            ? e
            : e.source === connection.source && e.target === connection.target
            ? { ...e, id: savedEdge.id }
            : e
        )
      );
      treeDataRef.current.edges.push(savedEdge);
    } catch {
      // Edge already added visually, just log
      console.error("Failed to save edge");
    }

    recomputeStatuses();
  },
  [setEdges, tree.id, recomputeStatuses]
);
```

- [ ] **Step 4: Run the dev server and verify status engine works**

Run: `npm run dev`

Test: Create two nodes, connect them with an edge. The target node should become "locked" if the source isn't completed. Complete the source — target should become "available".

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx src/lib/status-engine.ts
git commit -m "fix: integrate status engine — prerequisites now auto-lock nodes"
```

### Task 2: Auto-Save Inspector Changes with Debounce

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx`
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Add debounced auto-save to inspector-panel.tsx**

In `src/components/editor/inspector-panel.tsx`, replace the manual save flow with a debounced auto-save. Add a ref for the debounce timer and an auto-save effect:

Replace the `save` function and add auto-save effect. Remove the `dirty` and `saveState` states for the manual button and replace with:

```typescript
const [saveState, setSaveState] = useState<SaveState>("idle");
const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Auto-save with debounce
useEffect(() => {
  if (!node) return;

  // Don't auto-save on initial load
  const currentData = {
    title, description, difficulty, estimatedHours, progress, status, subTasks, resources, notes,
  };
  const originalData = {
    title: node.title,
    description: node.description || "",
    difficulty: node.difficulty,
    estimatedHours: node.estimatedHours?.toString() || "",
    progress: node.progress,
    status: node.status,
    subTasks: node.subTasks,
    resources: node.resources,
    notes: node.notes || "",
  };

  // Shallow compare
  const isDirty = JSON.stringify(currentData) !== JSON.stringify(originalData);
  if (!isDirty) return;

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
}, [title, description, difficulty, estimatedHours, progress, status, subTasks, resources, notes]);
```

- [ ] **Step 2: Remove the manual Save button, replace with auto-save indicator**

In the inspector-panel Actions section, remove the Save Changes button and replace it with a status indicator:

Replace the save button block in the Actions section with:

```tsx
<div className={`text-center py-2 text-xs font-mono rounded-md transition ${
  saveState === "saving" ? "text-poe-progress-blue bg-poe-progress-blue/5 border border-poe-progress-blue/20" :
  saveState === "saved" ? "text-poe-complete-bright bg-poe-complete-green/5 border border-poe-complete-green/20" :
  saveState === "failed" ? "text-poe-danger bg-poe-danger/5 border border-poe-danger/20" :
  saveState === "unsaved" ? "text-poe-gold-bright bg-poe-gold-mid/5 border border-poe-gold-mid/20" :
  "text-poe-text-dim"
}`}>
  {saveState === "saving" ? "Auto-saving..." :
   saveState === "saved" ? "Saved" :
   saveState === "failed" ? "Save failed — retrying..." :
   saveState === "unsaved" ? "Saving in 1.5s..." :
   "All changes saved"}
</div>
```

- [ ] **Step 3: Remove the `dirty` state and `markDirty()` function**

Remove these lines from inspector-panel.tsx:
- `const [dirty, setDirty] = useState(false);`
- The `markDirty` function
- All calls to `markDirty()` in onChange handlers (the auto-save effect watches state directly)
- Remove `setDirty(false)` from the node load effect
- Remove the `dirty` indicator in the header (`{dirty && ...}`)

The onChange handlers should now just set state directly, e.g.:
```tsx
onChange={(e) => setTitle(e.target.value)}
```

- [ ] **Step 4: Verify auto-save works**

Run: `npm run dev`

Test: Select a node, change its title. After 1.5s of no typing, it should auto-save. The indicator should show "Saving in 1.5s..." then "Auto-saving..." then "Saved".

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: auto-save inspector changes with 1.5s debounce"
```

### Task 3: Subtask ↔ Progress Synchronization

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx`
- Modify: `src/lib/status-engine.ts`

- [ ] **Step 1: Import and use computeProgressFromSubtasks in inspector**

In `src/components/editor/inspector-panel.tsx`, add import:

```typescript
import { computeProgressFromSubtasks } from "@/lib/status-engine";
```

- [ ] **Step 2: Auto-update progress when subtasks change**

In the `toggleSubTask` function, after updating subtasks, also compute and set progress:

```typescript
function toggleSubTask(index: number) {
  const updated = subTasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
  setSubTasks(updated);
  const computed = computeProgressFromSubtasks(updated);
  if (computed >= 0) setProgress(computed);
}
```

Do the same in `addSubTask`:
```typescript
function addSubTask() {
  if (!newSubTask.trim()) return;
  const updated = [...subTasks, { title: newSubTask.trim(), done: false }];
  setSubTasks(updated);
  setNewSubTask("");
  const computed = computeProgressFromSubtasks(updated);
  if (computed >= 0) setProgress(computed);
}
```

And in `removeSubTask`:
```typescript
function removeSubTask(index: number) {
  const updated = subTasks.filter((_, i) => i !== index);
  setSubTasks(updated);
  const computed = computeProgressFromSubtasks(updated);
  if (computed >= 0) setProgress(computed);
}
```

- [ ] **Step 3: Disable manual progress slider when subtasks exist**

In the progress slider section, make it read-only when subtasks exist:

```tsx
<div className="mb-1">
  <label className="block text-[10px] text-poe-text-dim mb-1 uppercase tracking-wide">
    Progress: <span className="text-poe-text-secondary">{progress}%</span>
    {subTasks.length > 0 && (
      <span className="text-poe-text-dim ml-1">(auto from subtasks)</span>
    )}
  </label>
  <input
    type="range"
    value={progress}
    onChange={(e) => setProgress(parseInt(e.target.value))}
    min="0"
    max="100"
    disabled={subTasks.length > 0}
    className={`w-full accent-poe-gold-mid ${subTasks.length > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
  />
</div>
```

- [ ] **Step 4: Verify subtask-progress sync**

Run: `npm run dev`

Test: Create a node with 4 subtasks. Check 2 of them. Progress should auto-set to 50%. Check all 4 — progress should be 100%.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/inspector-panel.tsx src/lib/status-engine.ts
git commit -m "feat: auto-sync progress from subtask completion"
```

---

## Phase 2: UX Improvements

### Task 4: Keyboard Shortcuts

**Files:**
- Create: `src/lib/use-keyboard-shortcuts.ts`
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Create the keyboard shortcuts hook**

Create `src/lib/use-keyboard-shortcuts.ts`:

```typescript
import { useEffect } from "react";

interface ShortcutActions {
  onDelete: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onDeselect: () => void;
}

export function useKeyboardShortcuts(
  selectedNodeId: string | null,
  actions: ShortcutActions
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          actions.onDelete();
        }
      }

      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        if (selectedNodeId) {
          e.preventDefault();
          actions.onDuplicate();
        }
      }

      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        actions.onSave();
      }

      if (e.key === "Escape") {
        actions.onDeselect();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, actions]);
}
```

- [ ] **Step 2: Integrate shortcuts into skill-tree-editor.tsx**

In `src/components/editor/skill-tree-editor.tsx`, add:

```typescript
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
```

Inside `EditorInner`, after the existing callbacks, add:

```typescript
const shortcutActions = useMemo(
  () => ({
    onDelete: () => {
      if (selectedNodeId) handleDeleteNode(selectedNodeId);
    },
    onDuplicate: () => {
      if (selectedNodeId) handleDuplicateNode(selectedNodeId);
    },
    onSave: () => handleSave(),
    onDeselect: () => {
      setSelectedNodeId(null);
      setContextMenu(null);
    },
  }),
  [selectedNodeId]
);

useKeyboardShortcuts(selectedNodeId, shortcutActions);
```

Add `useMemo` to the React import at the top.

- [ ] **Step 3: Verify shortcuts**

Run: `npm run dev`

Test: Select a node, press Delete — node should be deleted. Select a node, press Ctrl+D — node should be duplicated. Press Ctrl+S — positions should save. Press Escape — deselect.

- [ ] **Step 4: Commit**

```bash
git add src/lib/use-keyboard-shortcuts.ts src/components/editor/skill-tree-editor.tsx
git commit -m "feat: add keyboard shortcuts — Delete, Ctrl+D, Ctrl+S, Escape"
```

### Task 5: Smart Node Placement

**Files:**
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Replace random placement with smart positioning**

In `src/components/editor/skill-tree-editor.tsx`, replace the `handleAddNode` function:

```typescript
async function handleAddNode() {
  // Smart placement: below selected node, or center of viewport
  let posX = 300;
  let posY = 300;

  if (selectedNodeId) {
    const selectedFlowNode = nodes.find((n) => n.id === selectedNodeId);
    if (selectedFlowNode) {
      posX = selectedFlowNode.position.x;
      posY = selectedFlowNode.position.y + 180; // 180px below
    }
  } else if (nodes.length > 0) {
    // Place to the right of the rightmost node
    const maxX = Math.max(...nodes.map((n) => n.position.x));
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
    posX = maxX + 220;
    posY = avgY;
  }

  // Snap to grid (50px)
  posX = Math.round(posX / 50) * 50;
  posY = Math.round(posY / 50) * 50;

  const res = await fetch(`/api/trees/${tree.id}/nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "New Skill",
      positionX: posX,
      positionY: posY,
    }),
  });
  const node = await res.json();
  treeDataRef.current.nodes.push(node);
  setNodes((nds) => [
    ...nds,
    {
      id: node.id,
      type: "skillNode",
      position: { x: node.positionX, y: node.positionY },
      data: {
        title: node.title,
        status: node.status,
        difficulty: node.difficulty,
        progress: node.progress,
        description: node.description,
        selected: false,
      },
    },
  ]);
  setSelectedNodeId(node.id);
  recomputeStatuses();
}
```

- [ ] **Step 2: Verify smart placement**

Run: `npm run dev`

Test: Select a node and add a new one — it should appear 180px below. With no selection and existing nodes, the new node should appear to the right of the rightmost node.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx
git commit -m "feat: smart node placement — below selected or right of rightmost"
```

### Task 6: Edge Type Editing

**Files:**
- Create: `src/app/api/trees/[id]/edges/[edgeId]/route.ts` (add PUT handler)
- Modify: `src/components/editor/skill-tree-editor.tsx`
- Modify: `src/components/editor/inspector-panel.tsx`

- [ ] **Step 1: Add PUT handler for edge type updates**

Add a PUT handler to the existing edge route at `src/app/api/trees/[id]/edges/[edgeId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string; edgeId: string } }) {
  const { id, edgeId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const edge = await prisma.skillEdge.update({
    where: { id: edgeId },
    data: { type: body.type },
  });

  return NextResponse.json(edge);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; edgeId: string } }) {
  const { id, edgeId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.skillEdge.delete({ where: { id: edgeId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add edge selection state and click handler in editor**

In `src/components/editor/skill-tree-editor.tsx`, add state for selected edge:

```typescript
const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
```

Add edge click handler:
```typescript
const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
  setSelectedEdgeId(edge.id);
  setSelectedNodeId(null);
}, []);
```

Update `onPaneClick`:
```typescript
const onPaneClick = useCallback(() => {
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
  setContextMenu(null);
}, []);
```

Update `onNodeClick` to clear edge selection:
```typescript
const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
  setSelectedNodeId(node.id);
  setSelectedEdgeId(null);
  setContextMenu(null);
}, []);
```

Add the `onEdgeClick` prop to ReactFlow:
```tsx
<ReactFlow
  ...
  onEdgeClick={onEdgeClick}
  ...
>
```

- [ ] **Step 3: Add edge type update function and pass to InspectorPanel**

In `skill-tree-editor.tsx`, add:

```typescript
async function handleUpdateEdgeType(edgeId: string, newType: string) {
  await fetch(`/api/trees/${tree.id}/edges/${edgeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: newType }),
  });
  treeDataRef.current.edges = treeDataRef.current.edges.map((e) =>
    e.id === edgeId ? { ...e, type: newType as "prerequisite" | "recommended" | "optional" } : e
  );
  setEdges((eds) =>
    eds.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, type: newType } } : e
    )
  );
  recomputeStatuses();
}
```

Pass to InspectorPanel:
```tsx
<InspectorPanel
  node={selectedNode}
  selectedEdge={selectedEdgeId ? {
    id: selectedEdgeId,
    type: (edges.find((e) => e.id === selectedEdgeId)?.data?.type as string) || "prerequisite",
  } : null}
  onUpdateEdgeType={handleUpdateEdgeType}
  onUpdate={handleUpdateNode}
  onDelete={handleDeleteNode}
  onDuplicate={handleDuplicateNode}
  onAddNode={handleAddNode}
  onAiEnhance={handleAiEnhance}
  aiEnhancing={aiEnhancing}
/>
```

- [ ] **Step 4: Add edge type UI to inspector panel**

In `src/components/editor/inspector-panel.tsx`, update the props interface:

```typescript
interface InspectorPanelProps {
  node: SkillNodeData | null;
  selectedEdge: { id: string; type: string } | null;
  onUpdateEdgeType: (edgeId: string, type: string) => void;
  onUpdate: (node: SkillNodeData) => Promise<void>;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onAddNode: () => void;
  onAiEnhance: (nodeId: string | null) => void;
  aiEnhancing: boolean;
}
```

Add edge type selector in the panel. When a node is not selected but an edge is, show the edge editor. Add this before the `if (!node)` check:

```typescript
if (!node && selectedEdge) {
  const edgeTypeOptions = [
    { value: "prerequisite", label: "Prerequisite", color: "text-poe-gold-bright border-poe-gold-mid" },
    { value: "recommended", label: "Recommended", color: "text-poe-energy-blue border-poe-energy-blue" },
    { value: "optional", label: "Optional", color: "text-poe-text-dim border-poe-border-mid" },
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
              onClick={() => onUpdateEdgeType(selectedEdge.id, opt.value)}
              className={`px-3 py-2 rounded border text-xs font-mono uppercase transition text-left ${
                selectedEdge.type === opt.value
                  ? `${opt.color} bg-white/5`
                  : "border-poe-border-dim text-poe-text-dim hover:border-poe-border-mid"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Update the function signature to destructure the new props:

```typescript
export function InspectorPanel({
  node,
  selectedEdge,
  onUpdateEdgeType,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddNode,
  onAiEnhance,
  aiEnhancing,
}: InspectorPanelProps) {
```

- [ ] **Step 5: Verify edge type editing**

Run: `npm run dev`

Test: Click an edge — inspector should show edge type options. Change type to "recommended" — edge should change to dashed blue. Change to "optional" — edge should become dim dotted.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/trees/[id]/edges/[edgeId]/route.ts src/components/editor/skill-tree-editor.tsx src/components/editor/inspector-panel.tsx
git commit -m "feat: click edges to change type — prerequisite/recommended/optional"
```

### Task 7: Node Tooltip on Hover

**Files:**
- Modify: `src/components/editor/skill-node.tsx`

- [ ] **Step 1: Add tooltip component inside skill-node**

In `src/components/editor/skill-node.tsx`, add a hover state and tooltip:

```typescript
import { memo, useState } from "react";
```

Replace `SkillNodeComponent` with:

```typescript
function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress, description, selected } =
    data as unknown as SkillNodePayload;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`poe-node ${stateClasses[status]} ${
        selected ? "poe-node-selected" : ""
      } min-w-[130px] max-w-[180px] px-3 py-2.5 cursor-pointer`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-top-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />

      <div className="flex items-center justify-between mb-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: stateRingColor[status] }}
        />
        <DifficultyPips level={difficulty} />
      </div>

      <div className="text-sm font-semibold text-poe-text-primary leading-tight truncate">
        {title}
      </div>

      <div className={`text-[10px] mt-1 uppercase tracking-wider font-mono ${statusIndicator[status].color}`}>
        {statusIndicator[status].label}
      </div>

      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple"
          />
        </div>
      )}

      {/* Tooltip */}
      {hovered && !selected && description && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 pointer-events-none">
          <div className="bg-poe-obsidian border border-poe-border-mid rounded-lg px-3 py-2 shadow-2xl max-w-[220px]">
            <p className="text-[11px] text-poe-text-secondary leading-relaxed line-clamp-3">
              {description}
            </p>
            {status === "in_progress" && (
              <div className="mt-1.5 text-[10px] font-mono text-poe-progress-blue">{progress}% complete</div>
            )}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-poe-border-mid" />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-bottom-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify tooltip**

Run: `npm run dev`

Test: Hover over a node with a description. A tooltip should appear above the node showing the description. Should not appear when the node is selected (since inspector is visible).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-node.tsx
git commit -m "feat: add hover tooltip showing description on nodes"
```

### Task 8: Enhanced Context Menu

**Files:**
- Modify: `src/components/editor/context-menu.tsx`
- Modify: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Expand context menu with status change and zoom**

In `src/components/editor/context-menu.tsx`, update the interface and component:

```typescript
"use client";

import type { NodeStatus } from "@/types";

interface ContextMenuProps {
  x: number;
  y: number;
  nodeStatus: NodeStatus;
  onDelete: () => void;
  onDuplicate: () => void;
  onStatusChange: (status: NodeStatus) => void;
  onZoomToNode: () => void;
  onClose: () => void;
}

const statusActions: { value: NodeStatus; label: string; icon: string }[] = [
  { value: "locked", label: "Set Sealed", icon: "🔒" },
  { value: "available", label: "Set Ready", icon: "⭐" },
  { value: "in_progress", label: "Set Active", icon: "⚡" },
  { value: "completed", label: "Set Mastered", icon: "✓" },
];

export function ContextMenu({
  x, y, nodeStatus, onDelete, onDuplicate, onStatusChange, onZoomToNode, onClose,
}: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 border border-poe-border-mid rounded-md shadow-2xl py-1 min-w-[180px] animate-fade-in"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
        }}
      >
        {/* Status group */}
        <div className="px-3 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-poe-text-dim font-mono mb-1">Status</div>
          {statusActions
            .filter((s) => s.value !== nodeStatus)
            .map((s) => (
              <button
                key={s.value}
                onClick={() => { onStatusChange(s.value); onClose(); }}
                className="w-full text-left px-2 py-1.5 text-xs text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition flex items-center gap-2"
              >
                <span className="text-[10px]">{s.icon}</span>
                {s.label}
              </button>
            ))}
        </div>

        <div className="h-px bg-poe-border-dim mx-2 my-1" />

        {/* Actions group */}
        <div className="px-1 py-1">
          <button
            onClick={() => { onZoomToNode(); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition"
          >
            Zoom to Node
          </button>
          <button
            onClick={() => { onDuplicate(); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover rounded transition"
          >
            Duplicate
          </button>
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full text-left px-4 py-2 text-sm text-poe-danger hover:bg-poe-danger/10 rounded transition"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire up new context menu props in editor**

In `src/components/editor/skill-tree-editor.tsx`, add a quick status change function:

```typescript
async function handleQuickStatusChange(nodeId: string, newStatus: NodeStatus) {
  const node = treeDataRef.current.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const updated = { ...node, status: newStatus };
  await handleUpdateNode(updated);
}
```

Add import for NodeStatus:
```typescript
import type { SkillTreeData, SkillNodeData, NodeStatus } from "@/types";
```

Update the ContextMenu usage in JSX:

```tsx
{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    nodeStatus={
      (treeDataRef.current.nodes.find((n) => n.id === contextMenu.nodeId)?.status) || "available"
    }
    onDelete={() => handleDeleteNode(contextMenu.nodeId)}
    onDuplicate={() => handleDuplicateNode(contextMenu.nodeId)}
    onStatusChange={(status) => handleQuickStatusChange(contextMenu.nodeId, status)}
    onZoomToNode={() => {
      fitView({ nodes: [{ id: contextMenu.nodeId }], duration: 400, padding: 0.5 });
      setContextMenu(null);
    }}
    onClose={() => setContextMenu(null)}
  />
)}
```

- [ ] **Step 3: Verify enhanced context menu**

Run: `npm run dev`

Test: Right-click a node. Menu should show status change options (excluding current status), zoom-to-node, duplicate, and delete. Change status — it should update the node immediately.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/context-menu.tsx src/components/editor/skill-tree-editor.tsx
git commit -m "feat: enhanced context menu — quick status change, zoom to node"
```

---

## Phase 3: Visual Polish (PoE Quality)

### Task 9: Node Size Tiers and Status Icons

**Files:**
- Modify: `src/components/editor/skill-node.tsx`

- [ ] **Step 1: Add node tier calculation and status icons**

In `src/components/editor/skill-node.tsx`, add tier logic and icon SVGs:

```typescript
type NodeTier = "small" | "notable" | "keystone";

function getNodeTier(difficulty: number): NodeTier {
  if (difficulty >= 5) return "keystone";
  if (difficulty >= 3) return "notable";
  return "small";
}

const tierSizes: Record<NodeTier, string> = {
  small: "min-w-[110px] max-w-[140px] px-2.5 py-2",
  notable: "min-w-[140px] max-w-[180px] px-3 py-3",
  keystone: "min-w-[170px] max-w-[220px] px-4 py-4",
};

const tierBorderRadius: Record<NodeTier, string> = {
  small: "rounded-lg",
  notable: "rounded-xl",
  keystone: "rounded-2xl",
};

function StatusIcon({ status }: { status: NodeStatus }) {
  const iconClass = "w-3.5 h-3.5";
  switch (status) {
    case "locked":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      );
    case "available":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      );
    case "in_progress":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
        </svg>
      );
    case "completed":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
  }
}
```

- [ ] **Step 2: Update the SkillNodeComponent to use tiers and icons**

Replace the `SkillNodeComponent`:

```typescript
function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress, description, selected } =
    data as unknown as SkillNodePayload;
  const [hovered, setHovered] = useState(false);
  const tier = getNodeTier(difficulty);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`poe-node poe-node-${tier} ${stateClasses[status]} ${
        selected ? "poe-node-selected" : ""
      } ${tierSizes[tier]} ${tierBorderRadius[tier]} cursor-pointer relative`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-top-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />

      {/* Header: icon + difficulty */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={`${statusIndicator[status].color} flex items-center gap-1.5`}>
          <StatusIcon status={status} />
          {tier === "keystone" && (
            <span className="text-[9px] font-mono uppercase tracking-wider opacity-60">Keystone</span>
          )}
        </div>
        <DifficultyPips level={difficulty} />
      </div>

      {/* Title */}
      <div className={`font-semibold text-poe-text-primary leading-tight truncate ${
        tier === "keystone" ? "text-base" : tier === "notable" ? "text-sm" : "text-xs"
      }`}>
        {title}
      </div>

      {/* Status label */}
      <div className={`text-[10px] mt-1 uppercase tracking-wider font-mono ${statusIndicator[status].color}`}>
        {statusIndicator[status].label}
      </div>

      {/* Progress bar */}
      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-poe-void rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple"
          />
        </div>
      )}

      {/* Tooltip */}
      {hovered && !selected && description && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 pointer-events-none">
          <div className="bg-poe-obsidian border border-poe-border-mid rounded-lg px-3 py-2 shadow-2xl max-w-[220px]">
            <p className="text-[11px] text-poe-text-secondary leading-relaxed line-clamp-3">
              {description}
            </p>
            {status === "in_progress" && (
              <div className="mt-1.5 text-[10px] font-mono text-poe-progress-blue">{progress}% complete</div>
            )}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-poe-border-mid" />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-bottom-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-node.tsx
git commit -m "feat: node size tiers (small/notable/keystone) with status icons"
```

### Task 10: Enhanced Node Glow and CSS Atmosphere

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add tier-specific CSS and enhanced glow effects**

In `src/app/globals.css`, add these rules after the existing `.poe-node-selected` block:

```css
/* Node tier enhancements */
.poe-node-keystone {
  border-width: 3px;
  background: radial-gradient(ellipse at 50% 30%, #1e1e45 0%, #12122e 100%);
}

.poe-node-keystone.poe-node-available {
  box-shadow:
    0 0 25px rgba(212, 160, 23, 0.4),
    0 0 60px rgba(212, 160, 23, 0.15),
    0 0 100px rgba(212, 160, 23, 0.05),
    inset 0 0 30px rgba(212, 160, 23, 0.08);
}

.poe-node-keystone.poe-node-in-progress {
  box-shadow:
    0 0 25px rgba(91, 94, 240, 0.45),
    0 0 60px rgba(124, 58, 237, 0.15),
    0 0 100px rgba(91, 94, 240, 0.05),
    inset 0 0 30px rgba(91, 94, 240, 0.08);
}

.poe-node-keystone.poe-node-completed {
  box-shadow:
    0 0 20px rgba(13, 150, 104, 0.4),
    0 0 50px rgba(13, 150, 104, 0.15),
    0 0 90px rgba(13, 150, 104, 0.05),
    inset 0 0 25px rgba(13, 150, 104, 0.08);
}

.poe-node-notable {
  border-width: 2px;
}

/* Enhanced selection ring — outer glow ring */
.poe-node-selected::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid var(--select-color, rgba(196, 148, 26, 0.3));
  opacity: 0.5;
  animation: select-ring-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes select-ring-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.02); }
}

/* Canvas atmosphere — subtle nebula */
.poe-canvas-bg::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 40% 30% at 25% 35%, rgba(91, 94, 240, 0.03) 0%, transparent 70%),
    radial-gradient(ellipse 35% 25% at 75% 65%, rgba(196, 148, 26, 0.025) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(124, 58, 237, 0.015) 0%, transparent 60%);
}

/* Completed node subtle particle shimmer */
.poe-node-completed::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: linear-gradient(135deg, 
    transparent 40%, 
    rgba(52, 211, 153, 0.08) 50%, 
    transparent 60%
  );
  background-size: 200% 200%;
  animation: completed-shimmer 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes completed-shimmer {
  0% { background-position: 200% 200%; }
  50% { background-position: 0% 0%; }
  100% { background-position: 200% 200%; }
}

/* In-progress node energy pulse */
.poe-node-in-progress::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 1px solid rgba(91, 94, 240, 0.15);
  animation: progress-energy 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes progress-energy {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.01); }
}

/* Available node golden beacon */
.poe-node-available::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  background: radial-gradient(ellipse at 50% 30%, rgba(232, 184, 40, 0.06) 0%, transparent 70%);
  animation: available-beacon 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes available-beacon {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* Hover enhancement — all non-locked nodes */
.poe-node:not(.poe-node-locked):hover:not(.poe-node-selected) {
  filter: brightness(1.25);
  transform: scale(1.05);
}

.poe-node-keystone:not(.poe-node-locked):hover:not(.poe-node-selected) {
  transform: scale(1.04);
}
```

- [ ] **Step 2: Update existing hover rule**

In `src/app/globals.css`, remove the old hover rule:

```css
/* REMOVE THIS: */
.poe-node:not(.poe-node-locked):hover:not(.poe-node-selected) {
  filter: brightness(1.2);
  transform: scale(1.03);
}
```

(It's replaced by the new rules in Step 1.)

- [ ] **Step 3: Add new keyframes to tailwind config**

In `tailwind.config.ts`, add to the `keyframes` section:

```typescript
"select-ring-pulse": {
  "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
  "50%": { opacity: "0.6", transform: "scale(1.02)" },
},
"completed-shimmer": {
  "0%": { backgroundPosition: "200% 200%" },
  "50%": { backgroundPosition: "0% 0%" },
  "100%": { backgroundPosition: "200% 200%" },
},
```

And add to `animation`:
```typescript
"select-ring-pulse": "select-ring-pulse 2s ease-in-out infinite",
"completed-shimmer": "completed-shimmer 4s ease-in-out infinite",
```

- [ ] **Step 4: Verify visual enhancements**

Run: `npm run dev`

Test: Keystone nodes (difficulty 5) should be visibly larger with stronger glow. Completed nodes should have a subtle green shimmer. In-progress nodes should have a blue energy pulse. The canvas should have subtle nebula gradients.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "style: enhanced node glows, canvas atmosphere, tier-specific effects"
```

### Task 11: Enhanced Edge Animations

**Files:**
- Modify: `src/components/editor/skill-edge.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Rewrite skill-edge with animated energy particles**

Replace `src/components/editor/skill-edge.tsx`:

```typescript
"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { EdgeType } from "@/types";

interface EdgeStyleDef {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
  glowColor?: string;
  glowWidth?: number;
  animated?: boolean;
  particleColor?: string;
}

const edgeStyles: Record<EdgeType, EdgeStyleDef> = {
  prerequisite: {
    stroke: "#c4941a",
    strokeWidth: 2.5,
    opacity: 0.85,
    glowColor: "rgba(196, 148, 26, 0.25)",
    glowWidth: 10,
    animated: true,
    particleColor: "#f5d060",
  },
  recommended: {
    stroke: "#818cf8",
    strokeWidth: 1.8,
    strokeDasharray: "8 4",
    opacity: 0.5,
    glowColor: "rgba(129, 140, 248, 0.15)",
    glowWidth: 6,
    animated: true,
    particleColor: "#a5b4fc",
  },
  optional: {
    stroke: "#404050",
    strokeWidth: 1.2,
    strokeDasharray: "4 4",
    opacity: 0.3,
  },
};

function SkillEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data,
  } = props;
  const edgeType = (data?.type as EdgeType) || "prerequisite";
  const style = edgeStyles[edgeType];

  const [edgePath] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  return (
    <>
      {/* Outer glow layer */}
      {style.glowColor && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.glowColor,
            strokeWidth: style.strokeWidth + (style.glowWidth || 8),
            opacity: 0.4,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Main edge line */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />

      {/* Energy flow particles */}
      {style.animated && (
        <>
          <BaseEdge
            path={edgePath}
            style={{
              stroke: style.particleColor || "#e8b828",
              strokeWidth: 2,
              strokeDasharray: "3 20",
              opacity: 0.8,
              animation: "edge-energy 1.5s linear infinite",
            }}
          />
          {/* Second particle layer, offset */}
          <BaseEdge
            path={edgePath}
            style={{
              stroke: style.particleColor || "#e8b828",
              strokeWidth: 1.5,
              strokeDasharray: "2 26",
              opacity: 0.5,
              animation: "edge-energy-slow 2.5s linear infinite",
            }}
          />
        </>
      )}

      {/* Invisible interaction area for clicking */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: "transparent",
          strokeWidth: 20,
          cursor: "pointer",
        }}
      />
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
```

- [ ] **Step 2: Add second energy animation keyframe**

In `src/app/globals.css`, add after the `edge-energy` keyframe:

```css
@keyframes edge-energy-slow {
  0% { stroke-dashoffset: 28; }
  100% { stroke-dashoffset: 0; }
}
```

- [ ] **Step 3: Verify edge animations**

Run: `npm run dev`

Test: Prerequisite edges should have gold energy particles flowing. Recommended edges should have blue particles. Optional edges should be dim and static. Clicking on any edge should select it (from Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/skill-edge.tsx src/app/globals.css
git commit -m "style: enhanced edge animations — dual-layer energy particles, interaction area"
```

### Task 12: Inspector Panel Visual Polish

**Files:**
- Modify: `src/components/editor/inspector-panel.tsx`

- [ ] **Step 1: Add section icons and visual refinement**

In `src/components/editor/inspector-panel.tsx`, update the `SectionHeader` component to accept an icon:

```typescript
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
```

Update section header usages:

```tsx
<SectionHeader icon={
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
}>Progression</SectionHeader>
```

```tsx
<SectionHeader icon={
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
}>Content</SectionHeader>
```

```tsx
<SectionHeader icon={
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
}>Actions</SectionHeader>
```

- [ ] **Step 2: Enhance the Identity section header**

Replace the plain "Identity" h4 with the SectionHeader pattern (but without the divider since it's the first section):

```tsx
<h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-3 flex items-center gap-2">
  <span className="text-poe-gold-dim">
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </span>
  Identity
</h4>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "style: inspector panel polish — section icons, visual refinement"
```

### Task 13: Journey Status Bar Enhancement

**Files:**
- Modify: `src/components/editor/journey-status-bar.tsx`

- [ ] **Step 1: Add percentage label and visual enhancement**

Replace `src/components/editor/journey-status-bar.tsx`:

```typescript
"use client";

interface JourneyStatusBarProps {
  nodes: { status: string; progress: number }[];
  selectedNodeTitle: string | null;
}

export function JourneyStatusBar({ nodes, selectedNodeTitle }: JourneyStatusBarProps) {
  const total = nodes.length;
  if (total === 0) return null;

  const completed = nodes.filter((n) => n.status === "completed").length;
  const inProgress = nodes.filter((n) => n.status === "in_progress").length;
  const available = nodes.filter((n) => n.status === "available").length;
  const locked = nodes.filter((n) => n.status === "locked").length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="h-11 border-t border-poe-border-dim bg-gradient-to-r from-[#0e0e24] via-[#10102a] to-[#0e0e24] flex items-center px-5 gap-6 z-10 relative">
      {/* Subtle top glow based on progress */}
      <div
        className="absolute top-0 left-0 h-px transition-all duration-1000"
        style={{
          width: `${percent}%`,
          background: percent === 100
            ? "linear-gradient(90deg, transparent, #34d399, transparent)"
            : "linear-gradient(90deg, transparent, #c4941a, transparent)",
          opacity: 0.6,
        }}
      />

      {/* Progress section */}
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xs font-cinzel font-semibold text-poe-gold-bright min-w-[36px]">
          {percent}%
        </span>
        <div className="flex-1 max-w-xs h-1.5 bg-poe-void rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percent}%`,
              background: percent === 100
                ? "linear-gradient(90deg, #0d9668, #34d399)"
                : "linear-gradient(90deg, #8b6914, #c4941a, #e8b828)",
            }}
          />
        </div>
        <span className="text-[10px] text-poe-text-dim font-mono whitespace-nowrap">
          {completed}/{total} mastered
        </span>
      </div>

      {/* Status counts */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim">
        <span className="flex items-center gap-1.5" title="Mastered">
          <span className="w-2 h-2 rounded-full bg-poe-complete-green shadow-[0_0_4px_rgba(13,150,104,0.5)]" />
          {completed}
        </span>
        <span className="flex items-center gap-1.5" title="Active">
          <span className="w-2 h-2 rounded-full bg-poe-progress-blue shadow-[0_0_4px_rgba(91,94,240,0.5)]" />
          {inProgress}
        </span>
        <span className="flex items-center gap-1.5" title="Ready">
          <span className="w-2 h-2 rounded-full bg-poe-gold-mid shadow-[0_0_4px_rgba(196,148,26,0.5)]" />
          {available}
        </span>
        <span className="flex items-center gap-1.5" title="Sealed">
          <span className="w-2 h-2 rounded-full bg-poe-locked-mid" />
          {locked}
        </span>
      </div>

      {/* Selected node indicator */}
      {selectedNodeTitle && (
        <div className="text-xs text-poe-text-secondary truncate max-w-[200px] flex items-center gap-1.5">
          <svg className="w-3 h-3 text-poe-gold-dim shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 15l-2 5L9 9l11 4-5 2z" />
          </svg>
          <span className="text-poe-gold-mid truncate">{selectedNodeTitle}</span>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-[9px] text-poe-text-dim font-mono hidden lg:flex items-center gap-2 opacity-50">
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">Del</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^D</kbd>
        <kbd className="px-1 py-0.5 border border-poe-border-dim rounded text-[8px]">^S</kbd>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify status bar**

Run: `npm run dev`

Test: Status bar should show percentage with gold label, enhanced dots with glow, keyboard shortcut hints on larger screens, and a top progress glow line.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/journey-status-bar.tsx
git commit -m "style: enhanced journey status bar — percentage, glow indicators, kbd hints"
```

### Task 14: Final Integration Test and Cleanup

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Fix any lint errors that appear.

- [ ] **Step 2: Run build**

Run: `npm run build`

Fix any TypeScript errors.

- [ ] **Step 3: Manual integration test**

Run: `npm run dev`

Test checklist:
- Create a new tree with AI generation
- Add nodes — verify smart placement
- Connect nodes — verify edge is persisted and target becomes locked
- Change node status via context menu — verify status engine recomputes
- Edit node in inspector — verify auto-save at 1.5s
- Add subtasks and toggle them — verify progress auto-updates
- Click an edge — verify edge type can be changed
- Hover over node — verify tooltip appears
- Keyboard shortcuts: Delete, Ctrl+D, Ctrl+S, Escape
- Visual check: keystone nodes are larger, completed nodes shimmer, edges have energy particles
- Status bar shows accurate counts and percentage

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and build fixes from integration testing"
```
