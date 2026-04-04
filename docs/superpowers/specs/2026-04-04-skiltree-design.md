# SkillTree — Interactive RPG-Style Skill Tree Builder

**URL:** skiltree.machinity.ai
**Date:** 2026-04-04
**Status:** Approved

## Overview

A web application for creating detailed, game-like skill trees on any topic. Users enter a subject, AI generates a structured skill tree, and users can manually edit every aspect. Trees can be shared via public links. Visual style is RPG/dark theme with glowing nodes, neon edges, and unlock animations.

## Tech Stack

- **Next.js 14** (App Router) — SSR + API routes
- **React Flow** — interactive canvas (node drag, edge connect, zoom, minimap)
- **Tailwind CSS** — RPG dark theme via utility classes
- **Framer Motion** — unlock animations, glow effects, transitions
- **NextAuth.js** — email/password auth (credentials provider, JWT sessions)
- **Prisma ORM** + **PostgreSQL 16** — data layer
- **OpenRouter API** — AI tree generation (Gemini Flash, existing key)
- **dagre** — automatic graph layout for AI-generated trees

## Architecture

```
User -> Traefik (HTTPS, skiltree.machinity.ai) -> Docker container:3000 (Next.js)
                                                      |-- App Router (SSR + Client)
                                                      |-- API Routes
                                                      |    |-- /api/auth/*     -> NextAuth.js
                                                      |    |-- /api/trees/*    -> CRUD tree/node/edge
                                                      |    |-- /api/generate   -> OpenRouter proxy
                                                      |    |-- /api/share/*    -> Public link management
                                                      |-- PostgreSQL (separate container)
```

## Data Model

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| email | String | Unique |
| passwordHash | String | bcrypt |
| name | String | Display name |
| createdAt | DateTime | |

### SkillTree
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK -> User |
| title | String | Tree title |
| description | String? | Optional description |
| slug | String | Unique, for public links |
| isPublic | Boolean | Default false |
| theme | String | Default "rpg-dark" |
| canvasState | Json? | Zoom level, viewport position |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### SkillNode
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| treeId | String | FK -> SkillTree |
| parentId | String? | Nullable for root nodes |
| title | String | Node title |
| description | String? | Rich text description |
| difficulty | Int | 1-5 stars |
| estimatedHours | Float? | Optional time estimate |
| progress | Int | 0-100 |
| status | Enum | locked, available, in_progress, completed |
| positionX | Float | Canvas X coordinate |
| positionY | Float | Canvas Y coordinate |
| style | Json? | Color, icon, size overrides |
| subTasks | Json | Array of {title, done} |
| resources | Json | Array of {title, url} |
| notes | String? | Freeform notes |
| subTreeId | String? | FK -> SkillTree (nested tree) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### SkillEdge
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| treeId | String | FK -> SkillTree |
| sourceNodeId | String | FK -> SkillNode |
| targetNodeId | String | FK -> SkillNode |
| type | Enum | prerequisite, recommended, optional |
| style | Json? | Color, animation overrides |

## Status Auto-Calculation

- All prerequisite edges completed -> node becomes `available`
- At least one sub-task done -> node becomes `in_progress`
- All sub-tasks done + progress == 100 -> node becomes `completed`
- Node with incomplete prerequisites stays `locked`

## RPG Visual Theme

### General
- Background: #0a0a1a with subtle grid texture
- Font: Inter (UI) + JetBrains Mono (values)
- Minimap: bottom-right, semi-transparent
- Zoom controls: bottom-left

### Node States
| Status | Visual |
|--------|--------|
| locked | Dimmed, grayscale, lock icon, pulsing shadow |
| available | Gold/amber border glow, "ready to unlock" effect |
| in_progress | Blue-purple gradient glow, progress bar visible |
| completed | Green/emerald glow, check icon, particle effect |

### Node Shape
Rounded hexagon — classic RPG aesthetic. Center: icon or short title. Bottom: difficulty stars.

### Edges
- Prerequisite: Neon line (source node color), flow animation (energy flowing)
- Recommended: Dashed line, dim glow
- Optional: Thin dotted, very subtle

### Unlock Animation
When a node is completed, connected nodes "wake up" sequentially — flash + ripple effect for locked -> available transition.

## AI Tree Generation

### Flow
1. User clicks "New Tree" -> enters topic (e.g., "Rust programming learning path")
2. Optional: current skill level, goal, time budget
3. Clicks "Generate with AI"
4. Backend sends structured prompt to OpenRouter (Gemini Flash)
5. AI returns JSON: nodes + edges + metadata
6. Result auto-laid out on canvas using dagre algorithm (top-down)
7. User edits freely

### Prompt Strategy
```
System: You are an education designer. Create a skill tree for the given topic.
Each node must include: title, description, difficulty(1-5), estimatedHours,
subTasks[], resources[{title,url}], recommended ordering.
Specify dependencies between nodes as prerequisite/recommended/optional.
Return as JSON.
```

### Expand Existing Tree
Select a node -> "Generate sub-tree with AI" -> deepens the selected node's topic into a nested skill tree.

## Pages

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing — intro + example tree animation + Login/Register | No |
| `/login` | Login form | No |
| `/register` | Registration form | No |
| `/dashboard` | User's trees as cards (title, node count, progress %, last edit) | Yes |
| `/tree/new` | New tree — enter topic + AI generate or start blank | Yes |
| `/tree/[id]` | Editor — React Flow canvas + right panel + toolbar | Yes (owner) |
| `/s/[slug]` | Public view — read-only canvas with node detail on click | No |

### Editor Layout
```
+-----------------------------------------------------+
| Toolbar: [Tree Name] [Save] [Share] [AI Expand]     |
+--------------------------------+--------------------+
|                                |  Node Detail Panel |
|                                |  (slides from right)|
|      React Flow Canvas         |  - Title/Desc      |
|      (nodes + edges)           |  - Sub-tasks       |
|                                |  - Resources       |
|                                |  - Notes           |
|                                |  - Sub Tree ->     |
+--------------------------------+--------------------+
| Minimap | Zoom |           Progress: 45%            |
+-----------------------------------------------------+
```

### Editor Interactions
- Double-click node -> detail panel opens (everything editable)
- Right-click node -> context menu (delete, add edge, create sub-tree, duplicate)
- Drag from toolbox to add new node
- Drag from node handle to create edge

## Auth & Sharing

### Auth
- NextAuth.js Credentials provider
- Email + password registration/login
- Password hashed with bcrypt
- JWT session strategy, 30-day expiry
- Protected routes via Next.js middleware: `/dashboard`, `/tree/new`, `/tree/[id]`

### Sharing
- Each tree has a unique `slug` (e.g., `rust-ogrenme-yolu-a3f8`)
- "Share" button sets `isPublic: true` + copies link
- Public URL: `skiltree.machinity.ai/s/[slug]`
- No auth required for public view (read-only canvas)
- Owner can disable sharing anytime (`isPublic: false`)

### Authorization Rules
- Trees editable only by owner
- Public trees viewable by anyone
- API routes check session + ownership on every request

## Deployment

### Docker
- Multi-stage Dockerfile: `node:20-alpine` build -> production image
- `next build` + `next start` on port 3000
- PostgreSQL 16 Alpine as separate container
- Persistent volume for PostgreSQL data

### Compose
File: `~/Desktop/Machinity/landing/skiltree-compose.yml`
- `skiltree_app` container (Next.js, port 3000)
- `skiltree_db` container (PostgreSQL)
- Traefik labels for `skiltree.machinity.ai`
- `machinity_proxy_net` external network
- HTTP -> HTTPS redirect

### DNS
`skiltree.machinity.ai` A record pointing to same server IP as `futbol.machinity.ai`.
