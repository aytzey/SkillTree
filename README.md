# SkillTree

SkillTree is an AI-assisted learning planner that turns any topic into an interactive RPG-style skill tree. Users can generate a roadmap with AI, edit every node and dependency manually, track progress, and share trees through public view or token-based public edit links.

This project was built as a product-grade full-stack app rather than a static demo. The focus is on visual identity, graph editing UX, and practical learning workflows.

## Portfolio Highlights

- AI-generated skill trees powered by OpenRouter
- Custom skill-tree editor built on React Flow
- Automatic node status engine driven by prerequisites and sub-tasks
- Public sharing modes: private, public read-only, and public edit
- Portable JSON export/import plus full backup import/export
- Keyboard shortcuts, context actions, edge management, and polished editor UX
- Authenticated dashboards and per-user tree ownership

## Core Features

- Generate a complete tree from a topic and learner level
- Edit nodes with descriptions, difficulty, time estimates, notes, resources, and subtasks
- Create prerequisite, recommended, and optional edges
- Ask AI for contextual node suggestions above, below, or parallel to an existing skill
- Auto-compute progress states such as `locked`, `available`, `in_progress`, and `completed`
- Share trees through public URLs or limited public edit links
- Import an external tree into a new project or replace an existing tree
- Browse personal trees from a dashboard with a themed landing and editor experience

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- React Flow (`@xyflow/react`)
- Prisma ORM
- PostgreSQL
- NextAuth credentials auth
- OpenRouter API
- Jest

## Architecture

### Frontend

- Landing page, auth pages, dashboard, tree editor, and public share pages
- Interactive canvas with custom nodes, custom edges, inspector panel, and context menu
- Rich visual system inspired by dark fantasy ARPG interfaces

### Backend

- App Router API routes for auth, generation, enhancement, sharing, import/export, and editor mutations
- Prisma-backed persistence for users, trees, nodes, and edges
- Access control for private, public read-only, and public edit states

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a local env file from the example:

```bash
cp .env.example .env.local
```

### 3. Start PostgreSQL and sync the schema

Set `DATABASE_URL` to a PostgreSQL database, then run:

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `OPENROUTER_API_KEY` | Required for AI tree generation and node suggestions |
| `NEXTAUTH_SECRET` | Secret used by NextAuth/Auth.js session signing |
| `NEXTAUTH_URL` | Base URL for local or deployed auth callbacks |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
```

## Data Model

The main entities are:

- `User`
- `SkillTree`
- `SkillNode`
- `SkillEdge`

Trees store layout state, share mode, nodes, and edges. Nodes include progress metadata, subtasks, resources, and notes. Edges define prerequisite, recommended, or optional relationships.

## Testing

Unit tests are available through Jest:

```bash
npm test
```

## Notes

- This repo expects a running PostgreSQL instance.
- AI features are optional at runtime but require `OPENROUTER_API_KEY`.
- Public edit links are token-based and intentionally separated from owner access.
