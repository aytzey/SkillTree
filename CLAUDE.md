# Skiltree

Next.js 14 (App Router) skill tree / roadmap editor. Built with React Flow, Prisma + Postgres, NextAuth, framer-motion. Production: https://skiltree.machinity.ai

## Repo layout

- `src/app/` — App Router routes (`/dashboard`, `/tree/[id]`, `/s/[slug]`, API under `src/app/api/**`)
- `src/components/editor/` — React Flow editor (`skill-tree-editor.tsx`, `inspector-panel.tsx`, `skill-node.tsx`, `world-header.tsx`, `journey-status-bar.tsx`)
- `src/lib/` — domain helpers (`status-engine.ts`, `tree-editor-utils.ts`, `tree-sharing.ts`, `copy-constants.ts`, `roadmap-ai-prompts.ts`, …)
- `prisma/schema.prisma` — DB schema; client output goes to `src/generated/prisma`
- `__tests__/` — Jest + RTL; run with `npx jest`
- `Dockerfile` + `docker-entrypoint.sh` — multi-stage prod image, entrypoint runs `prisma migrate deploy` on boot
- Deploy compose lives **outside** this repo at `../skiltree-compose.yml` (i.e. `Machinity/aytug/skiltree-compose.yml`)

## Local dev

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev          # http://localhost:3000
```

Tests: `npx jest` (58+ tests, must stay green before deploy).
Type-check: `npx tsc --noEmit` (test files have a pre-existing `@types/jest` gap — ignore those, keep `src/**` clean).

## Production deployment (skiltree.machinity.ai)

The production stack is a Docker Compose project named `skiltree`, defined in `Machinity/aytug/skiltree-compose.yml`. It runs two containers behind Traefik:

- `skiltree_app` — built from this repo's `Dockerfile`, exposes port 3000 internally, published via Traefik on `skiltree.machinity.ai` (and `www.`).
- `skiltree_db` — Postgres 16, internal-only, data on the named volume `skiltree_skiltree_pgdata`.

### Deploy a code change

After your fix is on `main` (push first — the build context reads from the working tree):

```bash
cd /home/dkmserver/Desktop/Machinity/aytug
docker compose -f skiltree-compose.yml up -d --build
```

That rebuilds the image, recreates `skiltree_app` (db keeps running), and runs `prisma migrate deploy` on boot via the entrypoint. Brief downtime (a few seconds) while the container is recreated. Volume `skiltree_skiltree_pgdata` is preserved.

Verify:

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep skilt
curl -sI -o /dev/null -w 'HTTP %{http_code}\n' https://skiltree.machinity.ai/
docker logs -n 50 skiltree_app
```

Both containers should report `(healthy)` and the URL should return `200`.

### Operational notes

- **Project name is `skiltree`** (set via `name:` at the top of the compose). Don't change it — the existing volume is bound to that project name.
- **Build context** is `./skiltree`, relative to `Machinity/aytug/`. If you ever move the compose, update that path.
- **Auto-up on reboot:** `Machinity/landing/auto-up.sh` (run by the `machinity-auto-up.service` systemd unit) brings the stack back with `docker compose up -d --no-build`. It does *not* rebuild — only restarts existing containers. After a code change you must run the manual rebuild command above.
- **Secrets** (`NEXTAUTH_SECRET`, `OPENROUTER_API_KEY`, db password) are inlined in the compose file. They are not in `.env` and are not loaded from anywhere else — edit the compose to rotate.
- **DB migrations** run automatically via `docker-entrypoint.sh` before Next.js starts. If a migration fails, the container won't become healthy; check `docker logs skiltree_app`.
- **Rolling back**: `docker compose -f skiltree-compose.yml up -d` after checking out the previous commit and rebuilding. There is no image registry — images are local-only.

### Don't

- Don't `down -v` — the `-v` flag deletes the Postgres volume.
- Don't expose `ports:` directly; everything goes through Traefik on `machinity_proxy_net`.
- Don't add a second compose file for skiltree under `landing/` — the move was deliberate so the deploy artifact lives next to the source repo.
