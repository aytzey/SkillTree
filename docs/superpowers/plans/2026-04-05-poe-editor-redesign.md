# PoE Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SkillTree editor with Path of Exile-inspired dark fantasy visuals, single-click selection workflow, persistent inspector panel, and dramatically improved node/edge/state presentation.

**Architecture:** Replace the current editor shell (toolbar + canvas + slide-out panel + progress bar) with a four-region layout: World Header, Canvas Stage, persistent Inspector/Codex Panel, and Journey Status Bar. Node components become PoE-style "relic" objects with strong state signaling. Edges become energy channels. Single click selects; inspector always visible.

**Tech Stack:** Next.js 14, @xyflow/react 12, Framer Motion, Tailwind CSS 3, CSS custom properties

---

## File Structure

```
src/
├── app/
│   ├── globals.css                          # MODIFY — new PoE CSS variables, keyframes, textures
│   ├── tree/[id]/page.tsx                   # MODIFY — pass selectedNodeId prop
│   └── s/[slug]/public-view.tsx             # MODIFY — match new visual language
├── components/
│   └── editor/
│       ├── skill-tree-editor.tsx            # REWRITE — new 4-region layout, single-click selection
│       ├── skill-node.tsx                   # REWRITE — PoE relic-style nodes
│       ├── skill-edge.tsx                   # REWRITE — energy channel edges
│       ├── world-header.tsx                 # CREATE — replaces toolbar.tsx
│       ├── inspector-panel.tsx              # CREATE — replaces node-detail-panel.tsx
│       ├── journey-status-bar.tsx           # CREATE — replaces progress-bar.tsx
│       ├── context-menu.tsx                 # MODIFY — expanded actions, PoE styling
│       ├── toolbar.tsx                      # DELETE after world-header replaces it
│       ├── node-detail-panel.tsx            # DELETE after inspector-panel replaces it
│       └── progress-bar.tsx                 # DELETE after journey-status-bar replaces it
└── types/
    └── index.ts                             # NO CHANGE
tailwind.config.ts                           # MODIFY — extended PoE color palette
```

---

### Task 1: PoE Theme Foundation — CSS Variables, Tailwind Config, Keyframes

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update Tailwind config with expanded PoE palette**

Replace the full content of `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        poe: {
          // Backgrounds
          void: "#050510",
          obsidian: "#0a0a18",
          slate: "#10102a",
          panel: "#141430",
          "panel-hover": "#1a1a3a",
          // Borders
          "border-dim": "#1e1e40",
          "border-mid": "#2a2a55",
          "border-bright": "#3a3a70",
          // Gold system
          "gold-dim": "#8b6914",
          "gold-mid": "#c4941a",
          "gold-bright": "#e8b828",
          "gold-shine": "#f5d060",
          // State colors
          "locked-dim": "#2a2a35",
          "locked-mid": "#404050",
          "available-glow": "#d4a017",
          "progress-blue": "#5b5ef0",
          "progress-purple": "#7c3aed",
          "complete-green": "#0d9668",
          "complete-bright": "#34d399",
          // Text
          "text-primary": "#e8e4df",
          "text-secondary": "#8a8a9a",
          "text-dim": "#5a5a6a",
          // Accents
          "energy-blue": "#818cf8",
          "energy-purple": "#a78bfa",
          "danger": "#ef4444",
        },
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "node-breathe": "node-breathe 3s ease-in-out infinite",
        "energy-flow": "energy-flow 2s linear infinite",
        "select-pulse": "select-pulse 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
      },
      keyframes: {
        "node-breathe": {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.15)" },
        },
        "energy-flow": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        "select-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px var(--select-color), 0 0 40px var(--select-color-dim)" },
          "50%": { boxShadow: "0 0 30px var(--select-color), 0 0 60px var(--select-color-dim)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Add PoE editor CSS to globals.css**

Append the following to the end of `src/app/globals.css` (keep existing landing page styles):

```css
/* ===================== POE EDITOR THEME ===================== */

/* Editor canvas background — deep obsidian with subtle texture */
.poe-canvas-bg {
  background-color: #050510;
  background-image:
    radial-gradient(ellipse 80% 60% at 50% 50%, rgba(90, 70, 20, 0.04) 0%, transparent 70%),
    radial-gradient(circle at 30% 40%, rgba(99, 102, 241, 0.02) 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(212, 160, 23, 0.02) 0%, transparent 50%);
}

/* Stone/metal texture for panels */
.poe-panel {
  background: linear-gradient(180deg, #141430 0%, #10102a 100%);
  border-color: #2a2a55;
}

/* World header ornate border */
.poe-header {
  background: linear-gradient(180deg, #141430 0%, #0e0e24 100%);
  border-bottom: 1px solid #2a2a55;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
}

/* Inspector panel left border glow */
.poe-inspector {
  background: linear-gradient(180deg, #121228 0%, #0e0e22 100%);
  border-left: 1px solid #2a2a55;
  box-shadow: -4px 0 30px rgba(0, 0, 0, 0.4);
}

/* Node base — relic frame */
.poe-node {
  position: relative;
  border-radius: 12px;
  border: 2px solid transparent;
  background: radial-gradient(ellipse at 50% 30%, #1a1a3a 0%, #10102a 100%);
  transition: all 0.3s ease;
}

/* Node states */
.poe-node-locked {
  border-color: #2a2a35;
  opacity: 0.45;
  filter: saturate(0.2) brightness(0.7);
}

.poe-node-available {
  border-color: #c4941a;
  box-shadow:
    0 0 15px rgba(212, 160, 23, 0.25),
    0 0 40px rgba(212, 160, 23, 0.08),
    inset 0 0 20px rgba(212, 160, 23, 0.05);
  animation: node-breathe 3s ease-in-out infinite;
  --select-color: rgba(212, 160, 23, 0.5);
  --select-color-dim: rgba(212, 160, 23, 0.15);
}

.poe-node-in-progress {
  border-color: #5b5ef0;
  box-shadow:
    0 0 15px rgba(91, 94, 240, 0.3),
    0 0 40px rgba(124, 58, 237, 0.1),
    inset 0 0 20px rgba(91, 94, 240, 0.05);
  --select-color: rgba(91, 94, 240, 0.5);
  --select-color-dim: rgba(91, 94, 240, 0.15);
}

.poe-node-completed {
  border-color: #0d9668;
  box-shadow:
    0 0 12px rgba(13, 150, 104, 0.25),
    0 0 30px rgba(13, 150, 104, 0.08),
    inset 0 0 15px rgba(13, 150, 104, 0.05);
  --select-color: rgba(13, 150, 104, 0.5);
  --select-color-dim: rgba(13, 150, 104, 0.15);
}

/* Node selected overlay ring */
.poe-node-selected {
  animation: select-pulse 1.5s ease-in-out infinite;
}

/* Node hover — brighter but distinct from selected */
.poe-node:not(.poe-node-locked):hover:not(.poe-node-selected) {
  filter: brightness(1.2);
  transform: scale(1.03);
}

/* Section divider for inspector */
.poe-section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #2a2a55 50%, transparent 100%);
}

/* Ornate header divider */
.poe-ornate-border {
  background: linear-gradient(90deg,
    transparent 0%,
    #8b6914 20%,
    #c4941a 50%,
    #8b6914 80%,
    transparent 100%
  );
  height: 1px;
  opacity: 0.4;
}

/* Input fields — PoE style */
.poe-input {
  background: #0a0a18;
  border: 1px solid #1e1e40;
  border-radius: 6px;
  color: #e8e4df;
  transition: border-color 0.2s ease;
}

.poe-input:focus {
  outline: none;
  border-color: #c4941a;
  box-shadow: 0 0 10px rgba(196, 148, 26, 0.15);
}

.poe-input::placeholder {
  color: #5a5a6a;
}

/* Button styles */
.poe-btn {
  border: 1px solid #2a2a55;
  background: #141430;
  color: #8a8a9a;
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.poe-btn:hover {
  border-color: #3a3a70;
  color: #e8e4df;
  background: #1a1a3a;
}

.poe-btn-gold {
  border-color: #8b6914;
  color: #e8b828;
  background: rgba(196, 148, 26, 0.1);
}

.poe-btn-gold:hover {
  border-color: #c4941a;
  background: rgba(196, 148, 26, 0.2);
  color: #f5d060;
}

.poe-btn-danger {
  border-color: #7f1d1d;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.poe-btn-danger:hover {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

/* Save state indicators */
.poe-save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.poe-save-unsaved { background: #c4941a; }
.poe-save-saving { background: #5b5ef0; animation: node-breathe 1s ease-in-out infinite; }
.poe-save-saved { background: #0d9668; }
.poe-save-failed { background: #ef4444; }

/* Scrollbar for inspector */
.poe-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.poe-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.poe-scrollbar::-webkit-scrollbar-thumb {
  background: #2a2a55;
  border-radius: 3px;
}
.poe-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3a3a70;
}

/* Edge energy glow filter */
@keyframes edge-energy {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
```

- [ ] **Step 3: Verify the dev server starts**

Run: `cd /home/dkmserver/Desktop/Machinity/aytug/skiltree && npm run dev`
Expected: Server starts without CSS/config errors on port 3000.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "style: add PoE dark fantasy theme foundation — variables, palette, keyframes"
```

---

### Task 2: PoE Skill Node — Relic-Style Component

**Files:**
- Rewrite: `src/components/editor/skill-node.tsx`

- [ ] **Step 1: Rewrite skill-node.tsx with PoE relic design**

Replace the full content of `src/components/editor/skill-node.tsx`:

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { NodeStatus } from "@/types";

interface SkillNodePayload {
  title: string;
  status: NodeStatus;
  difficulty: number;
  progress: number;
  description: string | null;
  selected?: boolean;
}

const stateClasses: Record<NodeStatus, string> = {
  locked: "poe-node-locked",
  available: "poe-node-available",
  in_progress: "poe-node-in-progress",
  completed: "poe-node-completed",
};

const stateRingColor: Record<NodeStatus, string> = {
  locked: "#2a2a35",
  available: "#c4941a",
  in_progress: "#5b5ef0",
  completed: "#0d9668",
};

const statusIndicator: Record<NodeStatus, { label: string; color: string }> = {
  locked: { label: "Sealed", color: "text-poe-locked-mid" },
  available: { label: "Ready", color: "text-poe-gold-bright" },
  in_progress: { label: "Active", color: "text-poe-progress-blue" },
  completed: { label: "Mastered", color: "text-poe-complete-bright" },
};

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level ? "bg-poe-gold-mid" : "bg-poe-border-dim"
          }`}
        />
      ))}
    </div>
  );
}

function SkillNodeComponent({ data, id }: NodeProps) {
  const { title, status, difficulty, progress, selected } =
    data as unknown as SkillNodePayload;

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`poe-node ${stateClasses[status]} ${
        selected ? "poe-node-selected" : ""
      } min-w-[130px] max-w-[180px] px-3 py-2.5 cursor-pointer`}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full !-top-1.5"
        style={{
          background: stateRingColor[status],
          borderColor: "#0a0a18",
        }}
      />

      {/* Status indicator dot */}
      <div className="flex items-center justify-between mb-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: stateRingColor[status] }}
        />
        <DifficultyPips level={difficulty} />
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-poe-text-primary leading-tight truncate">
        {title}
      </div>

      {/* Status label */}
      <div className={`text-[10px] mt-1 uppercase tracking-wider font-mono ${statusIndicator[status].color}`}>
        {statusIndicator[status].label}
      </div>

      {/* Progress bar — only for in_progress */}
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

      {/* Source handle */}
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

export const SkillNode = memo(SkillNodeComponent);
```

- [ ] **Step 2: Verify node renders in dev**

Run: `npm run dev`
Navigate to an existing tree editor page. Nodes should render with the new PoE styling. Locked nodes should appear muted; available nodes should glow gold.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-node.tsx
git commit -m "feat: redesign skill node as PoE relic — state glow, difficulty pips, status labels"
```

---

### Task 3: PoE Skill Edge — Energy Channels

**Files:**
- Rewrite: `src/components/editor/skill-edge.tsx`

- [ ] **Step 1: Rewrite skill-edge.tsx with energy channel visuals**

Replace the full content of `src/components/editor/skill-edge.tsx`:

```tsx
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
  animated?: boolean;
}

const edgeStyles: Record<EdgeType, EdgeStyleDef> = {
  prerequisite: {
    stroke: "#c4941a",
    strokeWidth: 2.5,
    opacity: 0.85,
    glowColor: "rgba(196, 148, 26, 0.3)",
    animated: true,
  },
  recommended: {
    stroke: "#818cf8",
    strokeWidth: 1.8,
    strokeDasharray: "8 4",
    opacity: 0.45,
  },
  optional: {
    stroke: "#404050",
    strokeWidth: 1.2,
    strokeDasharray: "4 4",
    opacity: 0.25,
  },
};

function SkillEdgeComponent(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props;
  const edgeType = (data?.type as EdgeType) || "prerequisite";
  const style = edgeStyles[edgeType];

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {/* Glow layer for prerequisite edges */}
      {style.glowColor && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.glowColor,
            strokeWidth: style.strokeWidth + 6,
            opacity: 0.4,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* Main edge */}
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />

      {/* Animated energy flow for prerequisite */}
      {style.animated && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: "#e8b828",
            strokeWidth: 2,
            strokeDasharray: "6 18",
            opacity: 0.7,
            animation: "edge-energy 2s linear infinite",
          }}
        />
      )}
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
```

- [ ] **Step 2: Verify edges render**

Run: `npm run dev`
Navigate to a tree with edges. Prerequisite edges should glow gold with animated energy flow. Recommended edges should be dashed blue. Optional edges should be very subtle.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-edge.tsx
git commit -m "feat: redesign edges as PoE energy channels — glow, animation, hierarchy"
```

---

### Task 4: World Header — Replaces Toolbar

**Files:**
- Create: `src/components/editor/world-header.tsx`

- [ ] **Step 1: Create world-header.tsx**

Create `src/components/editor/world-header.tsx`:

```tsx
"use client";

import { useState } from "react";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface WorldHeaderProps {
  title: string;
  onSave: () => Promise<void>;
  onShare: () => void;
  onAiExpand: () => void;
  onAddNode: () => void;
  isPublic: boolean;
  saveState: SaveState;
}

const saveLabels: Record<SaveState, string> = {
  idle: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving...",
  saved: "Saved",
  failed: "Save failed",
};

const saveDotClass: Record<SaveState, string> = {
  idle: "poe-save-saved",
  unsaved: "poe-save-unsaved",
  saving: "poe-save-saving",
  saved: "poe-save-saved",
  failed: "poe-save-failed",
};

export function WorldHeader({
  title,
  onSave,
  onShare,
  onAiExpand,
  onAddNode,
  isPublic,
  saveState,
}: WorldHeaderProps) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    await onSave();
  }

  return (
    <div className="poe-header relative z-20">
      {/* Ornate top border */}
      <div className="poe-ornate-border" />

      <div className="h-14 flex items-center justify-between px-5">
        {/* Left: Tree identity + save state */}
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-lg font-cinzel font-semibold text-poe-text-primary truncate max-w-xs">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <span className={saveDotClass[saveState]} style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
            <span className="text-xs text-poe-text-dim font-mono">
              {saveLabels[saveState]}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAddNode}
            className="poe-btn px-3 py-1.5 text-sm"
          >
            + Node
          </button>
          <button
            onClick={onAiExpand}
            className="poe-btn px-3 py-1.5 text-sm"
            style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
          >
            AI Expand
          </button>

          {/* Share / Public state */}
          <button
            onClick={handleShare}
            className={`poe-btn px-3 py-1.5 text-sm ${
              isPublic
                ? "!border-poe-complete-green !text-poe-complete-bright !bg-poe-complete-green/10"
                : ""
            }`}
          >
            {copied ? "Link Copied!" : isPublic ? "Public" : "Share"}
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="poe-btn-gold px-4 py-1.5 text-sm font-semibold disabled:opacity-50 poe-btn"
          >
            {saveState === "saving" ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Ornate bottom border */}
      <div className="poe-ornate-border" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/world-header.tsx
git commit -m "feat: create PoE world header with save state, ornate borders"
```

---

### Task 5: Inspector / Codex Panel — Persistent Right Panel

**Files:**
- Create: `src/components/editor/inspector-panel.tsx`

- [ ] **Step 1: Create inspector-panel.tsx**

Create `src/components/editor/inspector-panel.tsx`:

```tsx
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

  // Sync local state when selected node changes
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
      {/* Panel header */}
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto poe-scrollbar p-4 space-y-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* === IDENTITY === */}
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

            {/* === PROGRESSION === */}
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

            {/* === CONTENT === */}
            <SectionHeader>Content</SectionHeader>

            {/* Sub-tasks */}
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

            {/* Resources */}
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

            {/* Notes */}
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

            {/* === ACTIONS === */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/inspector-panel.tsx
git commit -m "feat: create PoE inspector panel — sectioned codex, dirty/save state, empty state"
```

---

### Task 6: Journey Status Bar — Replaces Progress Bar

**Files:**
- Create: `src/components/editor/journey-status-bar.tsx`

- [ ] **Step 1: Create journey-status-bar.tsx**

Create `src/components/editor/journey-status-bar.tsx`:

```tsx
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
    <div className="h-10 border-t border-poe-border-dim bg-gradient-to-r from-[#0e0e24] to-[#10102a] flex items-center px-5 gap-6 z-10">
      {/* Progress bar */}
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1 max-w-xs h-1.5 bg-poe-void rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-poe-gold-dim to-poe-gold-bright rounded-full transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-poe-text-dim font-mono whitespace-nowrap">
          {completed}/{total} mastered
        </span>
      </div>

      {/* Node state summary */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-poe-text-dim">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-complete-green" />
          {completed}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-progress-blue" />
          {inProgress}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-gold-mid" />
          {available}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-poe-locked-mid" />
          {locked}
        </span>
      </div>

      {/* Current selection context */}
      {selectedNodeTitle && (
        <div className="text-xs text-poe-text-secondary truncate max-w-[200px]">
          <span className="text-poe-text-dim">Selected:</span>{" "}
          <span className="text-poe-gold-mid">{selectedNodeTitle}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/journey-status-bar.tsx
git commit -m "feat: create journey status bar with state summary and selection context"
```

---

### Task 7: Updated Context Menu — PoE Styling + More Actions

**Files:**
- Modify: `src/components/editor/context-menu.tsx`

- [ ] **Step 1: Rewrite context-menu.tsx**

Replace the full content of `src/components/editor/context-menu.tsx`:

```tsx
"use client";

interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}

export function ContextMenu({ x, y, onDelete, onDuplicate, onClose }: ContextMenuProps) {
  const items: MenuItem[] = [
    { label: "Duplicate", onClick: onDuplicate },
    { label: "Delete", onClick: onDelete, variant: "danger" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 border border-poe-border-mid rounded-md shadow-2xl py-1 min-w-[160px] animate-fade-in"
        style={{
          left: x,
          top: y,
          background: "linear-gradient(180deg, #141430 0%, #10102a 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(196,148,26,0.2)",
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full text-left px-4 py-2 text-sm transition ${
              item.variant === "danger"
                ? "text-poe-danger hover:bg-poe-danger/10"
                : "text-poe-text-secondary hover:text-poe-text-primary hover:bg-poe-panel-hover"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/context-menu.tsx
git commit -m "feat: update context menu with PoE styling and duplicate action"
```

---

### Task 8: Rebuild Main Editor — 4-Region Layout, Single-Click Selection

**Files:**
- Rewrite: `src/components/editor/skill-tree-editor.tsx`

- [ ] **Step 1: Rewrite skill-tree-editor.tsx**

Replace the full content of `src/components/editor/skill-tree-editor.tsx`:

```tsx
"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "./skill-node";
import { SkillEdge } from "./skill-edge";
import { WorldHeader } from "./world-header";
import { InspectorPanel } from "./inspector-panel";
import { JourneyStatusBar } from "./journey-status-bar";
import { ContextMenu } from "./context-menu";
import type { SkillTreeData, SkillNodeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";

interface EditorProps {
  tree: SkillTreeData;
}

function toFlowNodes(nodes: SkillNodeData[], selectedId: string | null): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "skillNode",
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      status: n.status,
      difficulty: n.difficulty,
      progress: n.progress,
      description: n.description,
      selected: n.id === selectedId,
    },
  }));
}

function toFlowEdges(edges: SkillTreeData["edges"]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "skillEdge",
    data: { type: e.type },
  }));
}

function EditorInner({ tree }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toFlowNodes(tree.nodes, null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toFlowEdges(tree.edges)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(tree.isPublic);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const treeDataRef = useRef(tree);
  const { fitView } = useReactFlow();

  const selectedNode = selectedNodeId
    ? treeDataRef.current.nodes.find((n) => n.id === selectedNodeId) || null
    : null;

  // Update node selected state in flow when selection changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: n.id === selectedNodeId },
      }))
    );
  }, [selectedNodeId, setNodes]);

  // Single click to select
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setContextMenu(null);
    },
    []
  );

  // Double click to zoom-focus
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      fitView({ nodes: [{ id: node.id }], duration: 400, padding: 0.5 });
    },
    [fitView]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        type: "skillEdge",
        data: { type: "prerequisite" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  async function handleSave() {
    setSaveState("saving");
    try {
      const nodePositions = nodes.map((n) => ({
        id: n.id,
        positionX: n.position.x,
        positionY: n.position.y,
      }));
      for (const np of nodePositions) {
        await fetch(`/api/trees/${tree.id}/nodes/${np.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionX: np.positionX, positionY: np.positionY }),
        });
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("failed");
    }
  }

  async function handleShare() {
    const res = await fetch(`/api/trees/${tree.id}/share`, { method: "POST" });
    const data = await res.json();
    setIsPublic(data.isPublic);
    if (data.shareUrl) {
      navigator.clipboard.writeText(`${window.location.origin}${data.shareUrl}`);
    }
  }

  async function handleAddNode() {
    const res = await fetch(`/api/trees/${tree.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Skill",
        positionX: Math.random() * 400 + 100,
        positionY: Math.random() * 400 + 100,
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
  }

  async function handleDeleteNode(nodeId: string) {
    await fetch(`/api/trees/${tree.id}/nodes/${nodeId}`, { method: "DELETE" });
    treeDataRef.current.nodes = treeDataRef.current.nodes.filter((n) => n.id !== nodeId);
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setContextMenu(null);
  }

  async function handleDuplicateNode(nodeId: string) {
    const original = treeDataRef.current.nodes.find((n) => n.id === nodeId);
    if (!original) return;
    const res = await fetch(`/api/trees/${tree.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${original.title} (copy)`,
        description: original.description,
        difficulty: original.difficulty,
        estimatedHours: original.estimatedHours,
        positionX: original.positionX + 50,
        positionY: original.positionY + 50,
        subTasks: original.subTasks,
        resources: original.resources,
        notes: original.notes,
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
    setContextMenu(null);
  }

  async function handleUpdateNode(updated: SkillNodeData) {
    await fetch(`/api/trees/${tree.id}/nodes/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    treeDataRef.current.nodes = treeDataRef.current.nodes.map((n) =>
      n.id === updated.id ? updated : n
    );
    setNodes((nds) =>
      nds.map((n) =>
        n.id === updated.id
          ? {
              ...n,
              data: {
                title: updated.title,
                status: updated.status,
                difficulty: updated.difficulty,
                progress: updated.progress,
                description: updated.description,
                selected: n.id === selectedNodeId,
              },
            }
          : n
      )
    );
  }

  return (
    <div className="h-screen flex flex-col bg-poe-void">
      {/* World Header */}
      <WorldHeader
        title={tree.title}
        onSave={handleSave}
        onShare={handleShare}
        onAiExpand={() => {}}
        onAddNode={handleAddNode}
        isPublic={isPublic}
        saveState={saveState}
      />

      {/* Main area: Canvas + Inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas Stage */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            className="poe-canvas-bg"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={50}
              size={1}
              color="rgba(196,148,26,0.04)"
            />
            <Controls
              className="!bg-poe-panel !border-poe-border-dim !rounded-md [&>button]:!bg-poe-panel [&>button]:!border-poe-border-dim [&>button]:!text-poe-text-dim [&>button:hover]:!text-poe-text-primary"
            />
            <MiniMap
              className="!bg-poe-obsidian !border-poe-border-dim !rounded-md"
              nodeColor={(n) => {
                const status = (n.data as { status: string })?.status;
                if (status === "completed") return "#0d9668";
                if (status === "in_progress") return "#5b5ef0";
                if (status === "available") return "#c4941a";
                return "#2a2a35";
              }}
              maskColor="rgba(5,5,16,0.85)"
            />
          </ReactFlow>

          {/* Context menu */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onDelete={() => handleDeleteNode(contextMenu.nodeId)}
              onDuplicate={() => handleDuplicateNode(contextMenu.nodeId)}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>

        {/* Inspector / Codex Panel */}
        <InspectorPanel
          node={selectedNode}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
          onAddNode={handleAddNode}
        />
      </div>

      {/* Journey Status Bar */}
      <JourneyStatusBar
        nodes={nodes.map((n) => ({
          status: (n.data as { status: string }).status,
          progress: (n.data as { progress: number }).progress,
        }))}
        selectedNodeTitle={selectedNode?.title || null}
      />
    </div>
  );
}

export function SkillTreeEditor({ tree }: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner tree={tree} />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Verify full editor layout renders**

Run: `npm run dev`
Navigate to a tree editor page. Verify:
- World Header shows at top with save state
- Canvas fills center with PoE-style background
- Inspector panel is always visible on the right
- Journey status bar is at the bottom
- Single click selects a node and updates the inspector
- Double click zoom-focuses the node
- Right click opens context menu

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/skill-tree-editor.tsx
git commit -m "feat: rebuild editor with 4-region PoE layout — single-click selection, persistent inspector"
```

---

### Task 9: Clean Up Old Components

**Files:**
- Delete: `src/components/editor/toolbar.tsx`
- Delete: `src/components/editor/node-detail-panel.tsx`
- Delete: `src/components/editor/progress-bar.tsx`

- [ ] **Step 1: Delete old files**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
rm src/components/editor/toolbar.tsx src/components/editor/node-detail-panel.tsx src/components/editor/progress-bar.tsx
```

- [ ] **Step 2: Verify no import errors remain**

Run: `npm run build`
Expected: Build succeeds. If any file still imports the deleted components, update the import to the new component name.

- [ ] **Step 3: Commit**

```bash
git add -A src/components/editor/
git commit -m "chore: remove old toolbar, node-detail-panel, progress-bar — replaced by PoE components"
```

---

### Task 10: Update Public View to Match PoE Language

**Files:**
- Modify: `src/app/s/[slug]/public-view.tsx`

- [ ] **Step 1: Rewrite public-view.tsx**

Replace the full content of `src/app/s/[slug]/public-view.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "@/components/editor/skill-node";
import { SkillEdge } from "@/components/editor/skill-edge";
import type { SkillNodeData, SkillEdgeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

interface PublicTreeViewProps {
  title: string;
  authorName: string;
  nodes: SkillNodeData[];
  edges: SkillEdgeData[];
}

export function PublicTreeView({ title, authorName, nodes, edges }: PublicTreeViewProps) {
  const [selectedNode, setSelectedNode] = useState<SkillNodeData | null>(null);

  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: "skillNode",
    position: { x: n.positionX, y: n.positionY },
    data: {
      title: n.title,
      status: n.status,
      difficulty: n.difficulty,
      progress: n.progress,
      description: n.description,
      selected: selectedNode?.id === n.id,
    },
    draggable: false,
  }));

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "skillEdge",
    data: { type: e.type },
  }));

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const fullNode = nodes.find((n) => n.id === node.id);
    if (fullNode) setSelectedNode(fullNode);
  }, [nodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-poe-void">
      {/* Header */}
      <div className="poe-header relative z-10">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-between px-5">
          <div>
            <h1 className="text-lg font-cinzel font-semibold text-poe-text-primary">{title}</h1>
            <p className="text-xs text-poe-text-dim">by {authorName}</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider bg-poe-energy-blue/10 text-poe-energy-blue px-3 py-1 rounded border border-poe-energy-blue/20">
            Read-only
          </span>
        </div>
        <div className="poe-ornate-border" />
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            className="poe-canvas-bg"
          >
            <Background variant={BackgroundVariant.Dots} gap={50} size={1} color="rgba(196,148,26,0.04)" />
            <Controls className="!bg-poe-panel !border-poe-border-dim !rounded-md [&>button]:!bg-poe-panel [&>button]:!border-poe-border-dim [&>button]:!text-poe-text-dim" />
            <MiniMap
              className="!bg-poe-obsidian !border-poe-border-dim !rounded-md"
              nodeColor={(n) => {
                const status = (n.data as { status: string })?.status;
                if (status === "completed") return "#0d9668";
                if (status === "in_progress") return "#5b5ef0";
                if (status === "available") return "#c4941a";
                return "#2a2a35";
              }}
              maskColor="rgba(5,5,16,0.85)"
            />
          </ReactFlow>
        </div>

        {/* Read-only inspector */}
        <div className="poe-inspector w-80 h-full flex flex-col">
          <div className="px-4 py-3 border-b border-poe-border-dim">
            <h3 className="text-sm font-cinzel font-semibold text-poe-text-dim uppercase tracking-wider">
              Codex
            </h3>
          </div>

          {!selectedNode ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-xs text-poe-text-dim text-center">Click a node to view details</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto poe-scrollbar p-4">
              {/* Title */}
              <h2 className="text-base font-semibold text-poe-gold-bright mb-1">{selectedNode.title}</h2>
              <div className="text-[10px] uppercase tracking-wider font-mono text-poe-text-dim mb-3">
                {selectedNode.status.replace("_", " ")}
              </div>

              {selectedNode.description && (
                <p className="text-sm text-poe-text-secondary mb-4 leading-relaxed">{selectedNode.description}</p>
              )}

              <div className="poe-section-divider my-3" />

              {/* Difficulty + hours */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= selectedNode.difficulty ? "bg-poe-gold-mid" : "bg-poe-border-dim"}`} />
                  ))}
                </div>
                {selectedNode.estimatedHours && (
                  <span className="text-xs text-poe-text-dim font-mono">{selectedNode.estimatedHours}h est.</span>
                )}
              </div>

              {/* Progress */}
              {selectedNode.status === "in_progress" && (
                <div className="mb-4">
                  <div className="h-1 bg-poe-void rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-poe-progress-blue to-poe-progress-purple rounded-full" style={{ width: `${selectedNode.progress}%` }} />
                  </div>
                  <span className="text-[10px] text-poe-text-dim font-mono">{selectedNode.progress}%</span>
                </div>
              )}

              {/* Sub-tasks */}
              {selectedNode.subTasks.length > 0 && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Sub-tasks</h4>
                  <div className="space-y-1">
                    {selectedNode.subTasks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded border flex items-center justify-center text-[8px] ${t.done ? "bg-poe-complete-green/20 border-poe-complete-green text-poe-complete-bright" : "border-poe-border-mid text-transparent"}`}>
                          {t.done && "✓"}
                        </span>
                        <span className={t.done ? "text-poe-text-dim line-through" : "text-poe-text-primary"}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Resources */}
              {selectedNode.resources.length > 0 && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Resources</h4>
                  <div className="space-y-1">
                    {selectedNode.resources.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-poe-energy-blue hover:text-poe-energy-purple transition truncate">
                        {r.title}
                      </a>
                    ))}
                  </div>
                </>
              )}

              {/* Notes */}
              {selectedNode.notes && (
                <>
                  <div className="poe-section-divider my-3" />
                  <h4 className="text-[10px] uppercase tracking-[0.15em] text-poe-text-dim font-mono mb-2">Notes</h4>
                  <p className="text-xs text-poe-text-secondary whitespace-pre-wrap leading-relaxed">{selectedNode.notes}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify public view renders**

Run: `npm run dev`
Navigate to a public tree URL (`/s/[slug]`). Verify:
- Same PoE visual language as the editor
- Single click shows node details in right panel
- Read-only badge visible
- No editing affordances

- [ ] **Step 3: Commit**

```bash
git add src/app/s/[slug]/public-view.tsx
git commit -m "feat: update public view to match PoE editor visual language"
```

---

### Task 11: Final Build Verification

**Files:** None — verification only.

- [ ] **Step 1: Run full build**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: All existing tests pass (status-engine and layout-engine tests are unaffected by UI changes).

- [ ] **Step 3: Manual smoke test checklist**

Run `npm run dev` and verify each item:

1. Editor page loads with 4-region layout (header, canvas, inspector, status bar)
2. Nodes appear with PoE relic styling and correct state colors
3. Single click selects a node and inspector updates
4. Double click zoom-focuses the selected node
5. Right click opens context menu with Delete and Duplicate
6. Inspector shows empty state when no node is selected
7. Inspector shows sectioned layout (Identity, Progression, Content, Actions) when node selected
8. Save button in header shows save state feedback
9. Share button toggles public state
10. Edges render with energy glow (prerequisite) and dimmer styles (recommended/optional)
11. Journey status bar shows node counts and selection context
12. Public view at `/s/[slug]` renders with same PoE visual language
13. Public view inspector is read-only

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete PoE editor redesign — dark fantasy UI, persistent inspector, single-click selection"
```
