# SkillTree Editor Redesign — Path of Exile Inspired UI/UX

**Date:** 2026-04-05  
**Status:** Approved in chat, pending written spec review
**Scope:** `/tree/[id]` editor experience first, with matching visual cleanup for `/s/[slug]` public view

## Summary

Redesign the tree editor so it no longer feels like a generic flow tool with RPG colors layered on top. The new editor should feel closer to a Path of Exile passive tree experience: darker, heavier, more ornate, more readable, and more satisfying to interact with. The main UX change is moving from a double-click-to-edit flow to a selection-first workflow with a persistent right-side inspector.

## Problems in the Current Editor

Based on the current implementation in `src/components/editor/*` and `src/app/s/[slug]/public-view.tsx`, the main problems are:

1. **The editing flow is awkward.** Selecting and editing depend too much on modal-like panel behavior and double click.
2. **The right panel feels like a stacked admin form.** It is functional but not pleasant or efficient.
3. **Nodes do not feel powerful enough.** They look like UI cards instead of meaningful passive skill points.
4. **State signaling is weak.** Hover, selected, locked, available, in-progress, and completed are not separated clearly enough.
5. **Toolbar hierarchy is generic.** It does not feel like part of the same world as the canvas.
6. **The canvas lacks gravitas.** The overall scene does not carry the dramatic, ritual-like feeling expected from the desired Path of Exile reference.

## Goals

- Rebuild the editor around a **single-click selection workflow**.
- Make the **right-side inspector** the primary editing surface.
- Push the visual language much closer to **Path of Exile-inspired dark fantasy**.
- Improve clarity of node state, focus, and progression.
- Make the editor feel premium and intentional, not like a default graph editor.
- Keep the existing data model and core tree editing capabilities intact.

## Non-Goals

- Redesign the landing page, dashboard, auth screens, or marketing surface in this spec.
- Change the database schema.
- Rebuild AI generation flows.
- Make the editor mobile-first. The target is desktop-first with graceful collapse on narrower screens.

## Design Direction

The chosen direction is:

- **Path of Exile feeling should be direct and strong**, not subtle.
- **The current editor layout can be replaced freely** if needed.
- **Single click selects a node**.
- **Editing happens in a persistent inspector**, not through a double-click-first interaction.

This should create a product that feels like a dark RPG planning board while still behaving like a clear, modern web application.

## Experience Principles

1. **Selection first** — the user should always know what is selected and what they can do next.
2. **Readability before ornament** — ornate visuals are important, but focus, hierarchy, and state must remain unmistakable.
3. **One primary editing surface** — the inspector is the main place for edits.
4. **Canvas as stage, panel as codex** — the center is dramatic and spatial; the right side is structured and informative.
5. **Strong state language** — status should be legible at a glance without reading every label.

## Information Architecture

### Main Editor Regions

The editor should be rebuilt into four clear regions:

1. **World Header**
   - Replaces the current plain toolbar look.
   - Contains tree identity, high-level actions, save/share state, and creation actions.
   - Should feel like part of the same fantasy world as the canvas.

2. **Canvas Stage**
   - The main visual focus.
   - Large, dramatic, spacious, and visually deep.
   - Holds nodes, edges, hover/focus states, and connection feedback.

3. **Inspector / Codex Panel**
   - Persistent on the right.
   - Always visible on desktop.
   - Shows empty state when nothing is selected.
   - Shows read-first summary + editable controls when a node is selected.

4. **Journey Status Bar**
   - Replaces the current minimal progress strip.
   - Communicates total progression, current selection context, and lightweight tree stats.

## Layout Specification

### World Header

The header should stop feeling like a standard SaaS toolbar. It should become a compact control band with stronger visual framing.

**Contents:**
- Tree title and optional short descriptor on the left
- Primary actions on the right: add node, connect/create mode, share/public state, save
- Save state messaging integrated into the header

**Behavior:**
- Save feedback must be visible here at all times: `unsaved`, `saving`, `saved`, `save failed`
- Share/public state must be explicit and legible
- Header must visually belong to the editor rather than look detached from it

### Canvas Stage

The canvas should feel like a ritual map or sacred atlas rather than a blank graph board.

**Canvas behavior:**
- Single click selects node and immediately updates the inspector
- Double click zoom-focuses the selected node for local inspection; it does not switch editing into a separate mode
- Right click opens secondary actions only
- Background should be darker and richer than the current dotted grid
- Controls and minimap should be visually integrated with the new theme

**Visual treatment:**
- Dark obsidian / stone base tones
- Dim ambient texture, subtle gold filigree energy, restrained magical glow
- Stronger depth and contrast around the active working zone

### Inspector / Codex Panel

The inspector should remain visible and become the primary editing tool.

#### Empty State
When no node is selected, show:
- a clear instruction to select a node
- quick actions such as create node or begin a connection workflow
- short guidance text instead of a blank panel

#### Selected State
When a node is selected, the panel should be structured into sections rather than a long raw form.

**Section order:**
1. **Identity**
   - title
   - short description
   - status / type framing
2. **Progression**
   - difficulty
   - progress
   - any prerequisite impact or state explanation
3. **Content**
   - subtasks
   - resources
   - notes
4. **Actions**
   - save
   - duplicate
   - delete
   - expand or related actions

**Panel rules:**
- The top of the panel should feel like an inspect view first, editor second.
- Inputs should not appear as a flat admin stack.
- Related controls should be grouped into visual blocks.
- Dirty state, saving state, and saved state must be shown clearly.
- Field-level problems should show inline indications instead of failing silently.

## Node System

Nodes should be redesigned from rounded UI cards into stronger, more iconic objects.

### Node Form

Each node should feel like a socketed relic or passive skill point, not a card.

**Required visual structure:**
- strong outer silhouette
- inner core or emblem area
- distinct selected ring / halo
- clear title zone
- secondary metadata area with weaker emphasis

### Node State Language

The state system should be unmistakable even when zoomed out.

- **Locked:** ash gray, dormant, muted, low-emission
- **Available:** gold / amber, awake, inviting
- **In Progress:** arcane blue-violet, energized
- **Completed:** noble emerald, resolved, stable

### Hierarchy Inside the Node

- Title is primary
- Status is primarily visual, not text-heavy
- Difficulty and progress should not compete equally with the title
- Hover and selected states must be visually different
- Selected must always overpower hover

## Edge System

Edges should stop reading like ordinary graph connectors.

### Visual Rules

- Prerequisite edges should feel like active channels of energy
- Recommended edges should be visibly secondary
- Optional edges should recede further into the background
- Edge glow and opacity should support the current node focus rather than create noise

### Interaction Rules

- Creating a connection must be more obvious than it is now
- While connecting, the UI should clearly indicate the current mode
- Selected node edges may be slightly emphasized to help local reading

## Interaction Model

### Core Interactions

- **Single click:** select node
- **Double click:** zoom-focus the selected node for local inspection
- **Right click:** secondary action menu
- **Canvas click:** clear selection and return the inspector to its empty state when appropriate

### Editing Model

- Selection should immediately update the inspector
- Common edits should happen in the inspector without needing modal mental shifts
- The inspector should support both read-first viewing and direct inline editing without opening a separate full-screen editor
- Context menu is helpful but not the main editing path
- Add node and connect flows must have clear visual mode indicators

## Feedback and System States

The redesign must improve micro-feedback across the whole editor.

### Required States

- no selection
- selected
- hover
- unsaved changes
- saving
- save success
- save failure
- public/shared
- read-only
- loading
- empty tree

### Rules

- Status changes should never be ambiguous
- Save behavior should be reflected in both the header and inspector
- Validation or input problems should be local and visible
- Public/share state should feel trustworthy and explicit

## Public View Alignment

The public tree view at `/s/[slug]` should inherit the same node language and overall atmosphere, but remain simpler than the full editor.

### Public View Rules

- Keep the same visual identity for nodes and edges
- Keep the right-side detail panel pattern for consistency
- Remove editing affordances
- Make read-only status explicit and always visible
- Preserve clarity over ornament in public mode

## Visual Tone

The target is **direct Path of Exile inspiration**, not a faint nod.

That means:
- darker and heavier materials
- richer gold/bronze accents
- more sacred / occult framing
- less generic glassy UI
- less “modern dashboard with neon borders”
- more “ancient system of power”

The result should still feel polished and intentional, not cluttered, parody-like, or unreadable.

## Implementation Boundaries

This redesign should primarily affect:

- `src/components/editor/skill-tree-editor.tsx`
- `src/components/editor/skill-node.tsx`
- `src/components/editor/skill-edge.tsx`
- `src/components/editor/node-detail-panel.tsx`
- `src/components/editor/toolbar.tsx`
- `src/components/editor/progress-bar.tsx` or its replacement
- `src/components/editor/context-menu.tsx`
- `src/app/s/[slug]/public-view.tsx`
- `src/app/globals.css`

The data model, route structure, and backend APIs should remain intact unless a very small UI-supporting adjustment is unavoidable.

## Acceptance Criteria

The redesign is successful when all of the following are true:

1. A node can be selected with a single click.
2. The right-side inspector remains visible and becomes the primary editing surface.
3. The editor no longer reads visually as a default flow builder with RPG colors.
4. Node states are distinguishable at a glance.
5. Selected state is dramatically clearer than hover state.
6. Save/share/read-only states are immediately understandable.
7. The editor feels closer to a Path of Exile passive tree planning experience.
8. The public read-only view feels like the same product family.

## Testing Focus

When implementation begins, testing should focus on:

- selection and deselection flow
- double-click zoom-focus behavior
- inspector update correctness
- save feedback visibility
- share/public state clarity
- right-click menu remaining secondary but functional
- readability of node states at different zoom levels
- visual consistency between editor and public view
- desktop behavior on common wide and medium viewport sizes

## Final Recommendation

Rebuild the editor experience decisively rather than iterating cosmetically on the current layout. Keep the existing tree data and editing capabilities, but replace the interaction model and visual language so the product feels darker, clearer, heavier, and much closer to the desired Path of Exile quality bar.