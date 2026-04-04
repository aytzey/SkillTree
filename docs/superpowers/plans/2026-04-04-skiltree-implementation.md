# SkillTree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive RPG-style skill tree builder at skiltree.machinity.ai where users create AI-generated skill trees, edit them manually, track progress, and share via public links.

**Architecture:** Next.js 14 App Router serves both SSR pages and API routes. React Flow handles the interactive canvas. Prisma + PostgreSQL store all data. OpenRouter (Gemini Flash) generates tree structures from user topics. Deployed as Docker container behind Traefik.

**Tech Stack:** Next.js 14, React Flow, Tailwind CSS, Framer Motion, NextAuth.js, Prisma, PostgreSQL 16, OpenRouter API, dagre

---

## File Structure

```
skiltree/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .env.local                       # Local dev (gitignored)
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (fonts, SessionProvider)
│   │   ├── globals.css              # Tailwind base + RPG theme vars
│   │   ├── page.tsx                 # Landing page (/)
│   │   ├── login/
│   │   │   └── page.tsx             # Login form
│   │   ├── register/
│   │   │   └── page.tsx             # Register form
│   │   ├── dashboard/
│   │   │   └── page.tsx             # User's tree list
│   │   ├── tree/
│   │   │   ├── new/
│   │   │   │   └── page.tsx         # New tree (topic + AI generate or blank)
│   │   │   └── [id]/
│   │   │       └── page.tsx         # Editor canvas
│   │   ├── s/
│   │   │   └── [slug]/
│   │   │       └── page.tsx         # Public read-only view
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts     # NextAuth handler
│   │       ├── register/
│   │       │   └── route.ts         # POST user registration
│   │       ├── trees/
│   │       │   ├── route.ts         # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts     # GET, PUT, DELETE tree
│   │       │       ├── nodes/
│   │       │       │   ├── route.ts           # POST create node
│   │       │       │   └── [nodeId]/
│   │       │       │       └── route.ts       # PUT, DELETE node
│   │       │       ├── edges/
│   │       │       │   ├── route.ts           # POST create edge
│   │       │       │   └── [edgeId]/
│   │       │       │       └── route.ts       # DELETE edge
│   │       │       └── share/
│   │       │           └── route.ts           # POST toggle public
│   │       └── generate/
│   │           └── route.ts         # POST AI tree generation
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── auth.ts                  # NextAuth config + helpers
│   │   ├── openrouter.ts            # OpenRouter API client
│   │   ├── layout-engine.ts         # dagre auto-layout
│   │   └── status-engine.ts         # Node status computation
│   ├── components/
│   │   ├── providers.tsx            # SessionProvider wrapper
│   │   ├── auth/
│   │   │   ├── login-form.tsx       # Login form (client component)
│   │   │   └── register-form.tsx    # Register form (client component)
│   │   ├── dashboard/
│   │   │   └── tree-card.tsx        # Single tree card
│   │   ├── editor/
│   │   │   ├── skill-tree-editor.tsx  # Main editor (React Flow wrapper)
│   │   │   ├── skill-node.tsx         # Custom node component
│   │   │   ├── skill-edge.tsx         # Custom animated edge
│   │   │   ├── toolbar.tsx            # Top toolbar (save, share, AI)
│   │   │   ├── node-detail-panel.tsx  # Right slide-out panel
│   │   │   ├── context-menu.tsx       # Right-click menu
│   │   │   └── progress-bar.tsx       # Bottom overall progress
│   │   └── landing/
│   │       └── hero-tree.tsx          # Animated demo tree
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript types
│   └── middleware.ts                  # Auth route protection
├── __tests__/
│   ├── lib/
│   │   ├── status-engine.test.ts
│   │   └── layout-engine.test.ts
│   └── api/
│       ├── trees.test.ts
│       ├── generate.test.ts
│       └── share.test.ts
└── docs/
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/types/index.ts`

- [ ] **Step 1: Create Next.js project**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

When prompted to overwrite, select yes. This creates the base Next.js 14 project with App Router.

- [ ] **Step 2: Install all dependencies**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm install @xyflow/react framer-motion next-auth@beta @prisma/client bcryptjs nanoid dagre
npm install -D prisma @types/bcryptjs @types/dagre jest @jest/globals ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

- [ ] **Step 3: Create shared TypeScript types**

Create `src/types/index.ts`:

```typescript
export type NodeStatus = "locked" | "available" | "in_progress" | "completed";
export type EdgeType = "prerequisite" | "recommended" | "optional";

export interface SubTask {
  title: string;
  done: boolean;
}

export interface Resource {
  title: string;
  url: string;
}

export interface SkillNodeData {
  id: string;
  treeId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  difficulty: number;
  estimatedHours: number | null;
  progress: number;
  status: NodeStatus;
  positionX: number;
  positionY: number;
  style: Record<string, unknown> | null;
  subTasks: SubTask[];
  resources: Resource[];
  notes: string | null;
  subTreeId: string | null;
}

export interface SkillEdgeData {
  id: string;
  treeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  style: Record<string, unknown> | null;
}

export interface SkillTreeData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  slug: string;
  isPublic: boolean;
  theme: string;
  canvasState: Record<string, unknown> | null;
  nodes: SkillNodeData[];
  edges: SkillEdgeData[];
}
```

- [ ] **Step 4: Configure .env.example**

Create `.env.example`:

```env
DATABASE_URL="postgresql://skiltree:skiltree@localhost:5432/skiltree"
NEXTAUTH_SECRET="change-me-in-production"
NEXTAUTH_URL="http://localhost:3000"
OPENROUTER_API_KEY="sk-or-v1-..."
```

Copy to `.env.local` with real values:

```bash
cp .env.example .env.local
```

Edit `.env.local` to set the OpenRouter key from the existing environment.

- [ ] **Step 5: Configure Jest**

Create `jest.config.ts`:

```typescript
import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
```

Add to `package.json` scripts:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Set up RPG theme globals.css**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0a0a1a;
  --bg-secondary: #111128;
  --bg-card: #16163a;
  --border-subtle: #2a2a5a;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --glow-gold: #f59e0b;
  --glow-blue: #6366f1;
  --glow-green: #10b981;
  --glow-locked: #475569;
  --neon-flow: #818cf8;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: "Inter", sans-serif;
}

/* Subtle grid background */
.bg-grid {
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

- [ ] **Step 7: Configure tailwind.config.ts with RPG colors**

Update `tailwind.config.ts`:

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
        rpg: {
          bg: "#0a0a1a",
          "bg-secondary": "#111128",
          card: "#16163a",
          border: "#2a2a5a",
          gold: "#f59e0b",
          blue: "#6366f1",
          green: "#10b981",
          locked: "#475569",
          neon: "#818cf8",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "flow": "flow 2s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        flow: {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Set up root layout with fonts**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "SkillTree — Interactive Skill Tree Builder",
  description: "Create beautiful, game-like skill trees on any topic with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-rpg-bg bg-grid min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create Providers wrapper (placeholder)**

Create `src/components/providers.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 10: Create placeholder landing page**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold text-rpg-gold">
        SkillTree
      </h1>
    </div>
  );
}
```

- [ ] **Step 11: Verify dev server starts**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

Visit http://localhost:3000 — should see "SkillTree" in gold on dark background.

- [ ] **Step 12: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add -A
git commit -m "feat: scaffold Next.js project with RPG theme and dependencies"
```

---

### Task 2: Prisma Schema + Database

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx prisma init
```

- [ ] **Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String      @id @default(cuid())
  email        String      @unique
  passwordHash String
  name         String
  createdAt    DateTime    @default(now())
  trees        SkillTree[]
}

enum NodeStatus {
  locked
  available
  in_progress
  completed
}

enum EdgeType {
  prerequisite
  recommended
  optional
}

model SkillTree {
  id          String      @id @default(cuid())
  userId      String
  title       String
  description String?
  slug        String      @unique
  isPublic    Boolean     @default(false)
  theme       String      @default("rpg-dark")
  canvasState Json?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  nodes       SkillNode[]
  edges       SkillEdge[]

  @@index([userId])
  @@index([slug])
}

model SkillNode {
  id             String     @id @default(cuid())
  treeId         String
  parentId       String?
  title          String
  description    String?
  difficulty     Int        @default(1)
  estimatedHours Float?
  progress       Int        @default(0)
  status         NodeStatus @default(locked)
  positionX      Float      @default(0)
  positionY      Float      @default(0)
  style          Json?
  subTasks       Json       @default("[]")
  resources      Json       @default("[]")
  notes          String?
  subTreeId      String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  tree           SkillTree  @relation(fields: [treeId], references: [id], onDelete: Cascade)
  parent         SkillNode? @relation("NodeHierarchy", fields: [parentId], references: [id])
  children       SkillNode[] @relation("NodeHierarchy")
  outgoingEdges  SkillEdge[] @relation("EdgeSource")
  incomingEdges  SkillEdge[] @relation("EdgeTarget")

  @@index([treeId])
}

model SkillEdge {
  id           String    @id @default(cuid())
  treeId       String
  sourceNodeId String
  targetNodeId String
  type         EdgeType  @default(prerequisite)
  style        Json?
  tree         SkillTree @relation(fields: [treeId], references: [id], onDelete: Cascade)
  sourceNode   SkillNode @relation("EdgeSource", fields: [sourceNodeId], references: [id], onDelete: Cascade)
  targetNode   SkillNode @relation("EdgeTarget", fields: [targetNodeId], references: [id], onDelete: Cascade)

  @@index([treeId])
}
```

- [ ] **Step 3: Create Prisma client singleton**

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Start local PostgreSQL and push schema**

If PostgreSQL is not running locally, start it via Docker for dev:

```bash
docker run -d --name skiltree_dev_db -e POSTGRES_USER=skiltree -e POSTGRES_PASSWORD=skiltree -e POSTGRES_DB=skiltree -p 5432:5432 postgres:16-alpine
```

Then push the schema:

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 6: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add prisma/schema.prisma src/lib/prisma.ts
git commit -m "feat: add Prisma schema with User, SkillTree, SkillNode, SkillEdge models"
```

---

### Task 3: Authentication (NextAuth.js)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/register/route.ts`, `src/middleware.ts`, `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`

- [ ] **Step 1: Create NextAuth configuration**

Create `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
```

- [ ] **Step 2: Create NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 3: Extend NextAuth types**

Create `src/types/next-auth.d.ts`:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}
```

- [ ] **Step 4: Create registration API route**

Create `src/app/api/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Email, password, and name are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, name: user.name },
    { status: 201 }
  );
}
```

- [ ] **Step 5: Create auth middleware**

Create `src/middleware.ts`:

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard", "/tree/new", "/tree/:id*"],
};
```

- [ ] **Step 6: Create login form component**

Create `src/components/auth/login-form.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm text-rpg-gold mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-rpg-gold mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-2 font-medium hover:bg-rpg-gold/30 transition disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Create register form component**

Create `src/components/auth/register-form.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    // Auto-login after registration
    await signIn("credentials", {
      email: body.email,
      password: body.password,
      redirect: false,
    });

    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm text-rpg-gold mb-1">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm text-rpg-gold mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-rpg-gold mb-1">
          Password (min 6 chars)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-2 font-medium hover:bg-rpg-gold/30 transition disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Create login page**

Create `src/app/login/page.tsx`:

```tsx
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-rpg-gold mb-8">Sign In</h1>
        <LoginForm />
        <p className="mt-4 text-sm text-slate-400">
          No account?{" "}
          <Link href="/register" className="text-rpg-gold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create register page**

Create `src/app/register/page.tsx`:

```tsx
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-rpg-gold mb-8">Create Account</h1>
        <RegisterForm />
        <p className="mt-4 text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-rpg-gold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Verify auth flow manually**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

1. Go to http://localhost:3000/register — create an account
2. Should redirect to /dashboard (will be 404, that's fine — middleware works)
3. Go to http://localhost:3000/login — sign in with same credentials
4. Visit http://localhost:3000/dashboard without auth — should redirect to /login

- [ ] **Step 11: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/lib/auth.ts src/app/api/auth src/app/api/register src/middleware.ts src/components/auth src/app/login src/app/register src/types/next-auth.d.ts
git commit -m "feat: add NextAuth email/password auth with login, register, and middleware"
```

---

### Task 4: Status Engine (TDD)

**Files:**
- Create: `src/lib/status-engine.ts`
- Test: `__tests__/lib/status-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/status-engine.test.ts`:

```typescript
import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";

function makeNode(overrides: Partial<SkillNodeData> & { id: string }): SkillNodeData {
  return {
    treeId: "tree1",
    parentId: null,
    title: "Node",
    description: null,
    difficulty: 1,
    estimatedHours: null,
    progress: 0,
    status: "locked",
    positionX: 0,
    positionY: 0,
    style: null,
    subTasks: [],
    resources: [],
    notes: null,
    subTreeId: null,
    ...overrides,
  };
}

function makeEdge(source: string, target: string, type: "prerequisite" | "recommended" | "optional" = "prerequisite"): SkillEdgeData {
  return {
    id: `${source}-${target}`,
    treeId: "tree1",
    sourceNodeId: source,
    targetNodeId: target,
    type,
    style: null,
  };
}

describe("computeNodeStatuses", () => {
  it("marks root node with no prerequisites as available", () => {
    const nodes = [makeNode({ id: "a" })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("available");
  });

  it("marks node as locked when prerequisite is not completed", () => {
    const nodes = [
      makeNode({ id: "a", status: "available" }),
      makeNode({ id: "b" }),
    ];
    const edges = [makeEdge("a", "b")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("locked");
  });

  it("marks node as available when all prerequisites are completed", () => {
    const nodes = [
      makeNode({ id: "a", progress: 100, subTasks: [{ title: "x", done: true }] }),
      makeNode({ id: "b" }),
    ];
    const edges = [makeEdge("a", "b")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("available");
  });

  it("marks node as in_progress when some sub-tasks are done", () => {
    const nodes = [
      makeNode({
        id: "a",
        subTasks: [
          { title: "x", done: true },
          { title: "y", done: false },
        ],
      }),
    ];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("in_progress");
  });

  it("marks node as completed when all sub-tasks done and progress is 100", () => {
    const nodes = [
      makeNode({
        id: "a",
        progress: 100,
        subTasks: [{ title: "x", done: true }],
      }),
    ];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("completed");
  });

  it("ignores recommended/optional edges for lock calculation", () => {
    const nodes = [
      makeNode({ id: "a" }),
      makeNode({ id: "b" }),
    ];
    const edges = [makeEdge("a", "b", "recommended")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("b")).toBe("available");
  });

  it("handles chain: a -> b -> c", () => {
    const nodes = [
      makeNode({ id: "a", progress: 100, subTasks: [{ title: "x", done: true }] }),
      makeNode({ id: "b" }),
      makeNode({ id: "c" }),
    ];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const result = computeNodeStatuses(nodes, edges);
    expect(result.get("a")).toBe("completed");
    expect(result.get("b")).toBe("available");
    expect(result.get("c")).toBe("locked");
  });

  it("node with no sub-tasks uses progress only — 100 = completed", () => {
    const nodes = [makeNode({ id: "a", progress: 100 })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("completed");
  });

  it("node with no sub-tasks and progress 0 is available (if no prereqs)", () => {
    const nodes = [makeNode({ id: "a", progress: 0 })];
    const result = computeNodeStatuses(nodes, []);
    expect(result.get("a")).toBe("available");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx jest __tests__/lib/status-engine.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/status-engine'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/status-engine.ts`:

```typescript
import type { SkillNodeData, SkillEdgeData, NodeStatus, SubTask } from "@/types";

export function computeNodeStatuses(
  nodes: SkillNodeData[],
  edges: SkillEdgeData[]
): Map<string, NodeStatus> {
  const result = new Map<string, NodeStatus>();

  // Build prerequisite map: targetId -> sourceIds[]
  const prereqs = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== "prerequisite") continue;
    const existing = prereqs.get(edge.targetNodeId) || [];
    existing.push(edge.sourceNodeId);
    prereqs.set(edge.targetNodeId, existing);
  }

  // First pass: compute intrinsic status (from progress/subTasks)
  const intrinsic = new Map<string, NodeStatus>();
  for (const node of nodes) {
    intrinsic.set(node.id, computeIntrinsicStatus(node));
  }

  // Second pass: apply prerequisite locking
  for (const node of nodes) {
    const prereqIds = prereqs.get(node.id) || [];
    if (prereqIds.length === 0) {
      result.set(node.id, intrinsic.get(node.id)!);
      continue;
    }

    const allPrereqsComplete = prereqIds.every(
      (id) => intrinsic.get(id) === "completed"
    );

    if (!allPrereqsComplete) {
      result.set(node.id, "locked");
    } else {
      result.set(node.id, intrinsic.get(node.id)!);
    }
  }

  return result;
}

function computeIntrinsicStatus(node: SkillNodeData): NodeStatus {
  const subTasks = node.subTasks as SubTask[];
  const hasSubTasks = subTasks.length > 0;

  if (hasSubTasks) {
    const allDone = subTasks.every((t) => t.done);
    const someDone = subTasks.some((t) => t.done);

    if (allDone && node.progress >= 100) return "completed";
    if (someDone) return "in_progress";
    return "available";
  }

  // No sub-tasks: use progress only
  if (node.progress >= 100) return "completed";
  return "available";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx jest __tests__/lib/status-engine.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/lib/status-engine.ts __tests__/lib/status-engine.test.ts
git commit -m "feat: add status engine with TDD — computes node statuses from prerequisites and progress"
```

---

### Task 5: Layout Engine (TDD)

**Files:**
- Create: `src/lib/layout-engine.ts`
- Test: `__tests__/lib/layout-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/layout-engine.test.ts`:

```typescript
import { autoLayout } from "@/lib/layout-engine";

describe("autoLayout", () => {
  it("positions a single node at center", () => {
    const result = autoLayout(
      [{ id: "a", width: 150, height: 80 }],
      []
    );
    expect(result.get("a")).toBeDefined();
    expect(typeof result.get("a")!.x).toBe("number");
    expect(typeof result.get("a")!.y).toBe("number");
  });

  it("positions connected nodes vertically (top-down)", () => {
    const result = autoLayout(
      [
        { id: "a", width: 150, height: 80 },
        { id: "b", width: 150, height: 80 },
      ],
      [{ source: "a", target: "b" }]
    );
    expect(result.get("a")!.y).toBeLessThan(result.get("b")!.y);
  });

  it("positions siblings side by side", () => {
    const result = autoLayout(
      [
        { id: "a", width: 150, height: 80 },
        { id: "b", width: 150, height: 80 },
        { id: "c", width: 150, height: 80 },
      ],
      [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
      ]
    );
    // b and c should be at same y level
    expect(result.get("b")!.y).toBe(result.get("c")!.y);
    // b and c should be at different x positions
    expect(result.get("b")!.x).not.toBe(result.get("c")!.x);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx jest __tests__/lib/layout-engine.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/layout-engine'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/layout-engine.ts`:

```typescript
import dagre from "dagre";

interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

interface LayoutEdge {
  source: string;
  target: string;
}

interface Position {
  x: number;
  y: number;
}

export function autoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: "TB" | "LR" = "TB"
): Map<string, Position> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 });

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const result = new Map<string, Position>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    result.set(node.id, { x: pos.x, y: pos.y });
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npx jest __tests__/lib/layout-engine.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/lib/layout-engine.ts __tests__/lib/layout-engine.test.ts
git commit -m "feat: add dagre-based auto-layout engine with TDD"
```

---

### Task 6: Tree CRUD API Routes

**Files:**
- Create: `src/app/api/trees/route.ts`, `src/app/api/trees/[id]/route.ts`, `src/app/api/trees/[id]/nodes/route.ts`, `src/app/api/trees/[id]/nodes/[nodeId]/route.ts`, `src/app/api/trees/[id]/edges/route.ts`, `src/app/api/trees/[id]/edges/[edgeId]/route.ts`, `src/app/api/trees/[id]/share/route.ts`

- [ ] **Step 1: Create helper to get session user**

Add to `src/lib/auth.ts` (append to existing file):

```typescript
import { getServerSession } from "next-auth";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
```

- [ ] **Step 2: Create trees list + create route**

Create `src/app/api/trees/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trees = await prisma.skillTree.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { nodes: true } },
      nodes: { select: { progress: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = trees.map((tree) => {
    const totalProgress = tree.nodes.length > 0
      ? Math.round(tree.nodes.reduce((sum, n) => sum + n.progress, 0) / tree.nodes.length)
      : 0;
    return {
      id: tree.id,
      title: tree.title,
      description: tree.description,
      slug: tree.slug,
      isPublic: tree.isPublic,
      nodeCount: tree._count.nodes,
      progress: totalProgress,
      updatedAt: tree.updatedAt,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${nanoid(6)}`;

  const tree = await prisma.skillTree.create({
    data: { userId: user.id, title, description, slug },
  });

  return NextResponse.json(tree, { status: 201 });
}
```

- [ ] **Step 3: Create single tree GET/PUT/DELETE route**

Create `src/app/api/trees/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tree = await prisma.skillTree.findUnique({
    where: { id: params.id },
    include: { nodes: true, edges: true },
  });

  if (!tree) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allow public access for public trees
  const user = await getSessionUser();
  if (!tree.isPublic && tree.userId !== user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(tree);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.skillTree.update({
    where: { id: params.id },
    data: {
      title: body.title ?? tree.title,
      description: body.description ?? tree.description,
      canvasState: body.canvasState ?? tree.canvasState,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.skillTree.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create node CRUD routes**

Create `src/app/api/trees/[id]/nodes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const node = await prisma.skillNode.create({
    data: {
      treeId: params.id,
      title: body.title || "New Skill",
      description: body.description || null,
      difficulty: body.difficulty ?? 1,
      estimatedHours: body.estimatedHours ?? null,
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      subTasks: body.subTasks ?? [],
      resources: body.resources ?? [],
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(node, { status: 201 });
}
```

Create `src/app/api/trees/[id]/nodes/[nodeId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const node = await prisma.skillNode.update({
    where: { id: params.nodeId },
    data: {
      title: body.title,
      description: body.description,
      difficulty: body.difficulty,
      estimatedHours: body.estimatedHours,
      progress: body.progress,
      status: body.status,
      positionX: body.positionX,
      positionY: body.positionY,
      style: body.style,
      subTasks: body.subTasks,
      resources: body.resources,
      notes: body.notes,
      subTreeId: body.subTreeId,
    },
  });

  return NextResponse.json(node);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.skillNode.delete({ where: { id: params.nodeId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create edge CRUD routes**

Create `src/app/api/trees/[id]/edges/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const edge = await prisma.skillEdge.create({
    data: {
      treeId: params.id,
      sourceNodeId: body.sourceNodeId,
      targetNodeId: body.targetNodeId,
      type: body.type ?? "prerequisite",
    },
  });

  return NextResponse.json(edge, { status: 201 });
}
```

Create `src/app/api/trees/[id]/edges/[edgeId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; edgeId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.skillEdge.delete({ where: { id: params.edgeId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create share toggle route**

Create `src/app/api/trees/[id]/share/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id: params.id } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.skillTree.update({
    where: { id: params.id },
    data: { isPublic: !tree.isPublic },
  });

  return NextResponse.json({
    isPublic: updated.isPublic,
    shareUrl: updated.isPublic ? `/s/${updated.slug}` : null,
  });
}
```

- [ ] **Step 7: Verify one route manually**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

Register/login, then:

```bash
# After getting cookie from browser, test tree creation
curl -X POST http://localhost:3000/api/trees \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"title":"Test Tree"}'
```

Expected: 201 with tree JSON including `id`, `slug`, `title`.

- [ ] **Step 8: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/app/api/trees src/lib/auth.ts
git commit -m "feat: add full CRUD API routes for trees, nodes, edges, and sharing"
```

---

### Task 7: Dashboard Page

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/components/dashboard/tree-card.tsx`

- [ ] **Step 1: Create tree card component**

Create `src/components/dashboard/tree-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface TreeCardProps {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
  progress: number;
  updatedAt: string;
  isPublic: boolean;
}

export function TreeCard({
  id,
  title,
  description,
  nodeCount,
  progress,
  updatedAt,
  isPublic,
}: TreeCardProps) {
  const timeAgo = getTimeAgo(new Date(updatedAt));

  return (
    <Link href={`/tree/${id}`}>
      <motion.div
        whileHover={{ scale: 1.02, borderColor: "rgba(245, 158, 11, 0.5)" }}
        className="bg-rpg-card border border-rpg-border rounded-xl p-5 cursor-pointer transition-colors"
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
          {isPublic && (
            <span className="text-xs bg-rpg-green/20 text-rpg-green px-2 py-0.5 rounded-full ml-2 shrink-0">
              Public
            </span>
          )}
        </div>

        {description && (
          <p className="text-sm text-slate-400 mb-3 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{nodeCount} nodes</span>
          <span>{timeAgo}</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-rpg-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progress === 100
                ? "var(--glow-green)"
                : "linear-gradient(90deg, var(--glow-blue), var(--glow-gold))",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="text-right text-xs text-slate-500 mt-1">{progress}%</div>
      </motion.div>
    </Link>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2: Create dashboard page**

Create `src/app/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TreeCard } from "@/components/dashboard/tree-card";

interface TreeSummary {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
  progress: number;
  updatedAt: string;
  isPublic: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trees")
      .then((r) => r.json())
      .then((data) => {
        setTrees(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-rpg-gold">My Skill Trees</h1>
        <button
          onClick={() => router.push("/tree/new")}
          className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-4 py-2 text-sm font-medium hover:bg-rpg-gold/30 transition"
        >
          + New Tree
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20">Loading...</div>
      ) : trees.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <p className="text-slate-400 text-lg mb-4">No skill trees yet</p>
          <button
            onClick={() => router.push("/tree/new")}
            className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-6 py-3 font-medium hover:bg-rpg-gold/30 transition"
          >
            Create Your First Tree
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trees.map((tree, i) => (
            <motion.div
              key={tree.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <TreeCard {...tree} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify dashboard renders**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

Login and visit http://localhost:3000/dashboard — should see empty state with "Create Your First Tree" button.

- [ ] **Step 4: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/app/dashboard src/components/dashboard
git commit -m "feat: add dashboard page with tree cards and empty state"
```

---

### Task 8: Editor — React Flow Canvas

**Files:**
- Create: `src/components/editor/skill-tree-editor.tsx`, `src/components/editor/skill-node.tsx`, `src/components/editor/skill-edge.tsx`, `src/components/editor/toolbar.tsx`, `src/components/editor/progress-bar.tsx`, `src/app/tree/[id]/page.tsx`

- [ ] **Step 1: Create custom skill node component**

Create `src/components/editor/skill-node.tsx`:

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
}

const statusStyles: Record<NodeStatus, string> = {
  locked:
    "border-rpg-locked/50 bg-rpg-bg/80 opacity-50 grayscale",
  available:
    "border-rpg-gold bg-rpg-card shadow-[0_0_20px_rgba(245,158,11,0.3)]",
  in_progress:
    "border-rpg-blue bg-rpg-card shadow-[0_0_20px_rgba(99,102,241,0.4)]",
  completed:
    "border-rpg-green bg-rpg-card shadow-[0_0_20px_rgba(16,185,129,0.4)]",
};

const statusIcons: Record<NodeStatus, string> = {
  locked: "\u{1F512}",
  available: "\u{2728}",
  in_progress: "\u{1F504}",
  completed: "\u{2705}",
};

function SkillNodeComponent({ data }: NodeProps) {
  const { title, status, difficulty, progress } = data as unknown as SkillNodePayload;
  const stars = "\u{2B50}".repeat(difficulty);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        relative px-4 py-3 rounded-xl border-2 min-w-[140px] max-w-[200px]
        transition-all duration-300 cursor-pointer
        ${statusStyles[status]}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-rpg-neon !w-3 !h-3 !border-2 !border-rpg-bg" />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{statusIcons[status]}</span>
        <span className="text-sm font-semibold text-white truncate">{title}</span>
      </div>

      <div className="text-xs text-slate-400">{stars}</div>

      {status === "in_progress" && (
        <div className="mt-2 h-1 bg-rpg-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rpg-blue to-rpg-gold rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-rpg-neon !w-3 !h-3 !border-2 !border-rpg-bg" />
    </motion.div>
  );
}

export const SkillNode = memo(SkillNodeComponent);
```

- [ ] **Step 2: Create custom animated edge**

Create `src/components/editor/skill-edge.tsx`:

```tsx
"use client";

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { EdgeType } from "@/types";

const edgeStyles: Record<EdgeType, { stroke: string; strokeDasharray?: string; opacity: number }> = {
  prerequisite: { stroke: "#818cf8", opacity: 0.8 },
  recommended: { stroke: "#818cf8", strokeDasharray: "8 4", opacity: 0.4 },
  optional: { stroke: "#475569", strokeDasharray: "4 4", opacity: 0.3 },
};

function SkillEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
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
      <BaseEdge
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: edgeType === "prerequisite" ? 2.5 : 1.5,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
        }}
      />
      {edgeType === "prerequisite" && (
        <BaseEdge
          path={edgePath}
          style={{
            stroke: style.stroke,
            strokeWidth: 2.5,
            strokeDasharray: "12 12",
            opacity: 0.6,
            animation: "flow 2s linear infinite",
          }}
        />
      )}
    </>
  );
}

export const SkillEdge = memo(SkillEdgeComponent);
```

- [ ] **Step 3: Create toolbar component**

Create `src/components/editor/toolbar.tsx`:

```tsx
"use client";

import { useState } from "react";

interface ToolbarProps {
  title: string;
  onSave: () => void;
  onShare: () => void;
  onAiExpand: () => void;
  onAddNode: () => void;
  isPublic: boolean;
  saving: boolean;
}

export function Toolbar({
  title,
  onSave,
  onShare,
  onAiExpand,
  onAddNode,
  isPublic,
  saving,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/80 backdrop-blur flex items-center justify-between px-4">
      <h2 className="text-lg font-semibold text-white truncate max-w-xs">
        {title}
      </h2>

      <div className="flex items-center gap-2">
        <button
          onClick={onAddNode}
          className="px-3 py-1.5 text-sm bg-rpg-card border border-rpg-border rounded-lg text-slate-300 hover:border-rpg-neon transition"
        >
          + Node
        </button>
        <button
          onClick={onAiExpand}
          className="px-3 py-1.5 text-sm bg-rpg-blue/20 border border-rpg-blue text-rpg-blue rounded-lg hover:bg-rpg-blue/30 transition"
        >
          AI Expand
        </button>
        <button
          onClick={handleShare}
          className={`px-3 py-1.5 text-sm border rounded-lg transition ${
            isPublic
              ? "bg-rpg-green/20 border-rpg-green text-rpg-green"
              : "bg-rpg-card border-rpg-border text-slate-300 hover:border-rpg-gold"
          }`}
        >
          {copied ? "Link Copied!" : isPublic ? "Public" : "Share"}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg hover:bg-rpg-gold/30 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create progress bar component**

Create `src/components/editor/progress-bar.tsx`:

```tsx
"use client";

interface ProgressBarProps {
  nodes: { status: string; progress: number }[];
}

export function ProgressBar({ nodes }: ProgressBarProps) {
  if (nodes.length === 0) return null;

  const completed = nodes.filter((n) => n.status === "completed").length;
  const percent = Math.round((completed / nodes.length) * 100);

  return (
    <div className="h-8 border-t border-rpg-border bg-rpg-bg-secondary/80 flex items-center px-4 gap-3">
      <div className="flex-1 h-1.5 bg-rpg-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rpg-blue to-rpg-green rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 font-mono w-16 text-right">
        {completed}/{nodes.length} ({percent}%)
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Create main editor component**

Create `src/components/editor/skill-tree-editor.tsx`:

```tsx
"use client";

import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SkillNode } from "./skill-node";
import { SkillEdge } from "./skill-edge";
import { Toolbar } from "./toolbar";
import { ProgressBar } from "./progress-bar";
import { NodeDetailPanel } from "./node-detail-panel";
import { ContextMenu } from "./context-menu";
import type { SkillTreeData, SkillNodeData } from "@/types";

const nodeTypes = { skillNode: SkillNode };
const edgeTypes = { skillEdge: SkillEdge };

interface EditorProps {
  tree: SkillTreeData;
}

function toFlowNodes(nodes: SkillNodeData[]): Node[] {
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

export function SkillTreeEditor({ tree }: EditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(tree.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(tree.edges));
  const [selectedNode, setSelectedNode] = useState<SkillNodeData | null>(null);
  const [isPublic, setIsPublic] = useState(tree.isPublic);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const treeDataRef = useRef(tree);

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

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const fullNode = treeDataRef.current.nodes.find((n) => n.id === node.id);
      if (fullNode) setSelectedNode(fullNode);
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  async function handleSave() {
    setSaving(true);
    const nodePositions = nodes.map((n) => ({
      id: n.id,
      positionX: n.position.x,
      positionY: n.position.y,
    }));

    // Save positions for each moved node
    for (const np of nodePositions) {
      await fetch(`/api/trees/${tree.id}/nodes/${np.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionX: np.positionX, positionY: np.positionY }),
      });
    }
    setSaving(false);
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
        },
      },
    ]);
  }

  async function handleDeleteNode(nodeId: string) {
    await fetch(`/api/trees/${tree.id}/nodes/${nodeId}`, { method: "DELETE" });
    treeDataRef.current.nodes = treeDataRef.current.nodes.filter((n) => n.id !== nodeId);
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
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
              },
            }
          : n
      )
    );
    setSelectedNode(updated);
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        title={tree.title}
        onSave={handleSave}
        onShare={handleShare}
        onAiExpand={() => {/* handled in Task 11 */}}
        onAddNode={handleAddNode}
        isPublic={isPublic}
        saving={saving}
      />

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-rpg-bg"
        >
          <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="rgba(99,102,241,0.08)" />
          <Controls className="!bg-rpg-card !border-rpg-border !rounded-lg [&>button]:!bg-rpg-card [&>button]:!border-rpg-border [&>button]:!text-white" />
          <MiniMap
            className="!bg-rpg-bg-secondary !border-rpg-border !rounded-lg"
            nodeColor="#6366f1"
            maskColor="rgba(10,10,26,0.8)"
          />
        </ReactFlow>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onUpdate={handleUpdateNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onDelete={() => handleDeleteNode(contextMenu.nodeId)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      <ProgressBar
        nodes={nodes.map((n) => ({
          status: (n.data as { status: string }).status,
          progress: (n.data as { progress: number }).progress,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create placeholder NodeDetailPanel and ContextMenu**

Create `src/components/editor/node-detail-panel.tsx` (full implementation in Task 9):

```tsx
"use client";

import type { SkillNodeData } from "@/types";

interface NodeDetailPanelProps {
  node: SkillNodeData;
  onUpdate: (node: SkillNodeData) => void;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-rpg-bg-secondary border-l border-rpg-border p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{node.title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
      </div>
      <p className="text-sm text-slate-400">Detail panel — implemented in Task 9</p>
    </div>
  );
}
```

Create `src/components/editor/context-menu.tsx`:

```tsx
"use client";

interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onDelete, onClose }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-rpg-card border border-rpg-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          onClick={onDelete}
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-rpg-bg transition"
        >
          Delete Node
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 7: Create editor page**

Create `src/app/tree/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { SkillTreeEditor } from "@/components/editor/skill-tree-editor";
import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";

export default async function TreeEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tree = await prisma.skillTree.findUnique({
    where: { id: params.id },
    include: { nodes: true, edges: true },
  });

  if (!tree || tree.userId !== user.id) redirect("/dashboard");

  // Compute statuses
  const nodesData: SkillNodeData[] = tree.nodes.map((n) => ({
    ...n,
    status: n.status as SkillNodeData["status"],
    subTasks: (n.subTasks as SkillNodeData["subTasks"]) || [],
    resources: (n.resources as SkillNodeData["resources"]) || [],
    style: n.style as Record<string, unknown> | null,
  }));

  const edgesData: SkillEdgeData[] = tree.edges.map((e) => ({
    ...e,
    type: e.type as SkillEdgeData["type"],
    style: e.style as Record<string, unknown> | null,
  }));

  const statuses = computeNodeStatuses(nodesData, edgesData);
  const nodesWithStatus = nodesData.map((n) => ({
    ...n,
    status: statuses.get(n.id) || n.status,
  }));

  const treeData = {
    id: tree.id,
    userId: tree.userId,
    title: tree.title,
    description: tree.description,
    slug: tree.slug,
    isPublic: tree.isPublic,
    theme: tree.theme,
    canvasState: tree.canvasState as Record<string, unknown> | null,
    nodes: nodesWithStatus,
    edges: edgesData,
  };

  return <SkillTreeEditor tree={treeData} />;
}
```

- [ ] **Step 8: Verify editor loads**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

1. Login, go to dashboard, click "New Tree"
2. (New tree page doesn't exist yet — manually create a tree via API or directly visit `/tree/<id>` after creating via dashboard)
3. Editor should show empty React Flow canvas with toolbar and progress bar

- [ ] **Step 9: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/components/editor src/app/tree
git commit -m "feat: add React Flow editor with custom RPG nodes, edges, toolbar, and context menu"
```

---

### Task 9: Node Detail Panel (Full Implementation)

**Files:**
- Modify: `src/components/editor/node-detail-panel.tsx`

- [ ] **Step 1: Implement the full detail panel**

Replace `src/components/editor/node-detail-panel.tsx`:

```tsx
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
  }

  function toggleSubTask(index: number) {
    const updated = subTasks.map((t, i) =>
      i === index ? { ...t, done: !t.done } : t
    );
    setSubTasks(updated);
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
        initial={{ x: 320 }}
        animate={{ x: 0 }}
        exit={{ x: 320 }}
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold resize-none"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setDifficulty(star)}
                  className={`text-lg ${star <= difficulty ? "text-rpg-gold" : "text-slate-600"}`}
                >
                  {"\u2B50"}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Estimated Hours</label>
            <input
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              min="0"
              step="0.5"
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold"
            />
          </div>

          {/* Progress */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Progress: {progress}%</label>
            <input
              type="range"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              min="0"
              max="100"
              className="w-full accent-rpg-gold"
            />
          </div>

          {/* Sub-tasks */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">
              Sub-tasks ({subTasks.filter((t) => t.done).length}/{subTasks.length})
            </label>
            <div className="space-y-1.5">
              {subTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleSubTask(i)}
                    className="accent-rpg-green"
                  />
                  <span className={`text-sm flex-1 ${task.done ? "text-slate-500 line-through" : "text-white"}`}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => removeSubTask(i)}
                    className="text-red-400 text-xs opacity-0 group-hover:opacity-100"
                  >
                    &times;
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
                className="flex-1 bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold"
              />
              <button onClick={addSubTask} className="text-xs text-rpg-gold hover:underline">
                Add
              </button>
            </div>
          </div>

          {/* Resources */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Resources</label>
            <div className="space-y-1.5">
              {resources.map((res, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-rpg-neon hover:underline flex-1 truncate"
                  >
                    {res.title}
                  </a>
                  <button
                    onClick={() => removeResource(i)}
                    className="text-red-400 text-xs opacity-0 group-hover:opacity-100"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 mt-2">
              <input
                value={newResTitle}
                onChange={(e) => setNewResTitle(e.target.value)}
                placeholder="Title..."
                className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold"
              />
              <div className="flex gap-2">
                <input
                  value={newResUrl}
                  onChange={(e) => setNewResUrl(e.target.value)}
                  placeholder="URL..."
                  className="flex-1 bg-rpg-bg border border-rpg-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rpg-gold"
                />
                <button onClick={addResource} className="text-xs text-rpg-gold hover:underline">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Freeform notes..."
              className="w-full bg-rpg-bg border border-rpg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rpg-gold resize-none"
            />
          </div>

          {/* Save button */}
          <button
            onClick={save}
            className="w-full bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-2 text-sm font-medium hover:bg-rpg-gold/30 transition"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify panel opens on double-click**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

Open editor with a tree that has nodes. Double-click a node — panel should slide in from right with all fields editable.

- [ ] **Step 3: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/components/editor/node-detail-panel.tsx
git commit -m "feat: implement full node detail panel with sub-tasks, resources, notes, and progress"
```

---

### Task 10: New Tree Page

**Files:**
- Create: `src/app/tree/new/page.tsx`

- [ ] **Step 1: Create the new tree page**

Create `src/app/tree/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function NewTreePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "blank" | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);

    // Create tree
    const treeRes = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const tree = await treeRes.json();

    if (mode === "ai" && topic.trim()) {
      // Generate with AI
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId: tree.id,
          topic,
          level,
        }),
      });

      if (!genRes.ok) {
        console.error("AI generation failed");
      }
    }

    router.push(`/tree/${tree.id}`);
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-rpg-gold mb-8 text-center">
        New Skill Tree
      </h1>

      {/* Title input (always shown) */}
      <div className="mb-6">
        <label className="block text-sm text-rpg-gold mb-1">Tree Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Rust Programming"
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>

      {/* Mode selection */}
      {!mode && (
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setMode("ai")}
            className="bg-rpg-card border border-rpg-blue rounded-xl p-6 text-center hover:border-rpg-blue/80 transition"
          >
            <div className="text-3xl mb-2">{"\u{1F916}"}</div>
            <div className="text-white font-semibold mb-1">AI Generate</div>
            <div className="text-xs text-slate-400">Enter a topic, AI creates the tree</div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setMode("blank")}
            className="bg-rpg-card border border-rpg-border rounded-xl p-6 text-center hover:border-rpg-gold transition"
          >
            <div className="text-3xl mb-2">{"\u{1F4DD}"}</div>
            <div className="text-white font-semibold mb-1">Blank Canvas</div>
            <div className="text-xs text-slate-400">Start from scratch</div>
          </motion.button>
        </div>
      )}

      {/* AI options */}
      {mode === "ai" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-rpg-gold mb-1">Topic</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what the skill tree should cover..."
              rows={3}
              className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-rpg-gold mb-1">Your Current Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-rpg-gold"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setMode(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="flex-1 bg-rpg-blue/20 border border-rpg-blue text-rpg-blue rounded-lg py-3 font-medium hover:bg-rpg-blue/30 transition disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate with AI"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Blank canvas button */}
      {mode === "blank" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <button
            onClick={() => setMode(null)}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
          >
            Back
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="flex-1 bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-3 font-medium hover:bg-rpg-gold/30 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Blank Tree"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify flow: dashboard -> new tree -> editor**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

1. Login -> dashboard -> click "New Tree"
2. Enter title, choose "Blank Canvas" -> click "Create"
3. Should redirect to editor page with empty canvas

- [ ] **Step 3: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/app/tree/new
git commit -m "feat: add new tree page with AI generate and blank canvas options"
```

---

### Task 11: AI Tree Generation (OpenRouter)

**Files:**
- Create: `src/lib/openrouter.ts`, `src/app/api/generate/route.ts`

- [ ] **Step 1: Create OpenRouter client**

Create `src/lib/openrouter.ts`:

```typescript
interface GeneratedNode {
  title: string;
  description: string;
  difficulty: number;
  estimatedHours: number;
  subTasks: { title: string; done: boolean }[];
  resources: { title: string; url: string }[];
  dependencies: string[];  // titles of prerequisite nodes
}

interface GeneratedTree {
  nodes: GeneratedNode[];
}

export async function generateSkillTree(
  topic: string,
  level: string
): Promise<GeneratedTree> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const systemPrompt = `You are an expert education designer. Create a skill tree for learning a topic.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    {
      "title": "Node title",
      "description": "What this skill covers",
      "difficulty": 1-5,
      "estimatedHours": number,
      "subTasks": [{"title": "subtask name", "done": false}],
      "resources": [{"title": "resource name", "url": "https://..."}],
      "dependencies": ["Title of prerequisite node"]
    }
  ]
}

Rules:
- Create 8-15 nodes for a well-structured tree
- Root nodes (fundamentals) have empty dependencies
- Use exact titles in dependencies to reference other nodes
- difficulty: 1=trivial, 2=easy, 3=medium, 4=hard, 5=expert
- Provide 2-4 sub-tasks per node
- Provide 1-3 real resources with valid URLs per node
- Order nodes from fundamentals to advanced`;

  const userPrompt = `Create a skill tree for: "${topic}"
The learner's current level: ${level}
Return only JSON, no markdown.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content) as GeneratedTree;

  return parsed;
}
```

- [ ] **Step 2: Create generate API route**

Create `src/app/api/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateSkillTree } from "@/lib/openrouter";
import { autoLayout } from "@/lib/layout-engine";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, topic, level } = await req.json();
  if (!treeId || !topic) {
    return NextResponse.json({ error: "treeId and topic required" }, { status: 400 });
  }

  const tree = await prisma.skillTree.findUnique({ where: { id: treeId } });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate tree from AI
  const generated = await generateSkillTree(topic, level || "beginner");

  // Create nodes
  const titleToId = new Map<string, string>();
  const nodeWidth = 150;
  const nodeHeight = 80;

  const layoutNodes = generated.nodes.map((n, i) => ({
    id: `temp-${i}`,
    width: nodeWidth,
    height: nodeHeight,
  }));

  // Build dependency edges for layout
  const layoutEdges: { source: string; target: string }[] = [];
  for (let i = 0; i < generated.nodes.length; i++) {
    for (const depTitle of generated.nodes[i].dependencies) {
      const depIndex = generated.nodes.findIndex(
        (n) => n.title.toLowerCase() === depTitle.toLowerCase()
      );
      if (depIndex >= 0) {
        layoutEdges.push({ source: `temp-${depIndex}`, target: `temp-${i}` });
      }
    }
  }

  // Compute layout positions
  const positions = autoLayout(layoutNodes, layoutEdges);

  // Create nodes in database
  for (let i = 0; i < generated.nodes.length; i++) {
    const gn = generated.nodes[i];
    const pos = positions.get(`temp-${i}`) || { x: i * 200, y: 0 };

    const node = await prisma.skillNode.create({
      data: {
        treeId,
        title: gn.title,
        description: gn.description,
        difficulty: Math.min(5, Math.max(1, gn.difficulty)),
        estimatedHours: gn.estimatedHours,
        positionX: pos.x,
        positionY: pos.y,
        subTasks: gn.subTasks || [],
        resources: gn.resources || [],
      },
    });

    titleToId.set(gn.title.toLowerCase(), node.id);
  }

  // Create edges
  for (const gn of generated.nodes) {
    const targetId = titleToId.get(gn.title.toLowerCase());
    if (!targetId) continue;

    for (const depTitle of gn.dependencies) {
      const sourceId = titleToId.get(depTitle.toLowerCase());
      if (!sourceId) continue;

      await prisma.skillEdge.create({
        data: {
          treeId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          type: "prerequisite",
        },
      });
    }
  }

  return NextResponse.json({ ok: true, nodeCount: generated.nodes.length });
}
```

- [ ] **Step 3: Verify AI generation end-to-end**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

1. Create new tree with "AI Generate" mode
2. Enter topic: "Python web development"
3. Click Generate
4. Should redirect to editor with AI-generated nodes laid out on canvas

- [ ] **Step 4: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/lib/openrouter.ts src/app/api/generate
git commit -m "feat: add AI tree generation via OpenRouter Gemini Flash with auto-layout"
```

---

### Task 12: Public Sharing View

**Files:**
- Create: `src/app/s/[slug]/page.tsx`

- [ ] **Step 1: Create public view page**

Create `src/app/s/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeNodeStatuses } from "@/lib/status-engine";
import type { SkillNodeData, SkillEdgeData } from "@/types";
import { PublicTreeView } from "./public-view";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tree = await prisma.skillTree.findUnique({
    where: { slug: params.slug },
    select: { title: true, description: true },
  });
  if (!tree) return { title: "Not Found" };
  return {
    title: `${tree.title} — SkillTree`,
    description: tree.description || `Skill tree: ${tree.title}`,
  };
}

export default async function PublicViewPage({
  params,
}: {
  params: { slug: string };
}) {
  const tree = await prisma.skillTree.findUnique({
    where: { slug: params.slug },
    include: { nodes: true, edges: true, user: { select: { name: true } } },
  });

  if (!tree || !tree.isPublic) notFound();

  const nodesData: SkillNodeData[] = tree.nodes.map((n) => ({
    ...n,
    status: n.status as SkillNodeData["status"],
    subTasks: (n.subTasks as SkillNodeData["subTasks"]) || [],
    resources: (n.resources as SkillNodeData["resources"]) || [],
    style: n.style as Record<string, unknown> | null,
  }));

  const edgesData: SkillEdgeData[] = tree.edges.map((e) => ({
    ...e,
    type: e.type as SkillEdgeData["type"],
    style: e.style as Record<string, unknown> | null,
  }));

  const statuses = computeNodeStatuses(nodesData, edgesData);
  const nodesWithStatus = nodesData.map((n) => ({
    ...n,
    status: statuses.get(n.id) || n.status,
  }));

  return (
    <PublicTreeView
      title={tree.title}
      authorName={tree.user.name}
      nodes={nodesWithStatus}
      edges={edgesData}
    />
  );
}
```

- [ ] **Step 2: Create the public view client component**

Create `src/app/s/[slug]/public-view.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
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

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const fullNode = nodes.find((n) => n.id === node.id);
      if (fullNode) setSelectedNode(fullNode);
    },
    [nodes]
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/80 backdrop-blur flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-xs text-slate-400">by {authorName}</p>
        </div>
        <span className="text-xs bg-rpg-neon/20 text-rpg-neon px-2 py-1 rounded-full">
          Read-only
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          className="bg-rpg-bg"
        >
          <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="rgba(99,102,241,0.08)" />
          <Controls className="!bg-rpg-card !border-rpg-border !rounded-lg [&>button]:!bg-rpg-card [&>button]:!border-rpg-border [&>button]:!text-white" />
          <MiniMap className="!bg-rpg-bg-secondary !border-rpg-border !rounded-lg" nodeColor="#6366f1" maskColor="rgba(10,10,26,0.8)" />
        </ReactFlow>

        {/* Read-only detail view */}
        {selectedNode && (
          <div className="absolute top-0 right-0 w-80 h-full bg-rpg-bg-secondary border-l border-rpg-border overflow-y-auto z-30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-rpg-gold">{selectedNode.title}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>

            {selectedNode.description && (
              <p className="text-sm text-slate-300 mb-4">{selectedNode.description}</p>
            )}

            <div className="text-xs text-slate-400 mb-2">
              Difficulty: {"\u{2B50}".repeat(selectedNode.difficulty)}
            </div>

            {selectedNode.estimatedHours && (
              <div className="text-xs text-slate-400 mb-4">
                Est. {selectedNode.estimatedHours}h
              </div>
            )}

            {selectedNode.subTasks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-slate-400 mb-2">Sub-tasks</h4>
                {selectedNode.subTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{t.done ? "\u{2705}" : "\u{2B1C}"}</span>
                    <span className={t.done ? "text-slate-500 line-through" : "text-white"}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedNode.resources.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-slate-400 mb-2">Resources</h4>
                {selectedNode.resources.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-rpg-neon hover:underline mb-1">
                    {r.title}
                  </a>
                ))}
              </div>
            )}

            {selectedNode.notes && (
              <div>
                <h4 className="text-xs text-slate-400 mb-2">Notes</h4>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedNode.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify public sharing**

1. Open a tree in the editor -> click "Share" to make public
2. Copy the link (e.g., `/s/rust-programming-abc123`)
3. Open in incognito/different browser — should show read-only view
4. Click nodes — detail panel shows info but not editable

- [ ] **Step 4: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/app/s
git commit -m "feat: add public read-only tree view with shareable slug URLs"
```

---

### Task 13: Landing Page

**Files:**
- Create: `src/components/landing/hero-tree.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create animated demo tree component**

Create `src/components/landing/hero-tree.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";

const demoNodes = [
  { id: 1, title: "Basics", x: 250, y: 40, status: "completed" as const },
  { id: 2, title: "Core Skills", x: 120, y: 160, status: "completed" as const },
  { id: 3, title: "Advanced", x: 380, y: 160, status: "in_progress" as const },
  { id: 4, title: "Specialization", x: 60, y: 280, status: "available" as const },
  { id: 5, title: "Expert Path", x: 250, y: 280, status: "locked" as const },
  { id: 6, title: "Mastery", x: 440, y: 280, status: "locked" as const },
];

const demoEdges = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 2, to: 4 },
  { from: 2, to: 5 },
  { from: 3, to: 5 },
  { from: 3, to: 6 },
];

const statusColors = {
  completed: { bg: "rgba(16,185,129,0.15)", border: "#10b981", glow: "0 0 20px rgba(16,185,129,0.4)" },
  in_progress: { bg: "rgba(99,102,241,0.15)", border: "#6366f1", glow: "0 0 20px rgba(99,102,241,0.4)" },
  available: { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", glow: "0 0 20px rgba(245,158,11,0.3)" },
  locked: { bg: "rgba(71,85,105,0.1)", border: "#475569", glow: "none" },
};

export function HeroTree() {
  return (
    <div className="relative w-[540px] h-[360px] mx-auto">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 540 360">
        {demoEdges.map((edge, i) => {
          const from = demoNodes.find((n) => n.id === edge.from)!;
          const to = demoNodes.find((n) => n.id === edge.to)!;
          return (
            <motion.line
              key={i}
              x1={from.x + 40}
              y1={from.y + 30}
              x2={to.x + 40}
              y2={to.y + 30}
              stroke="#818cf8"
              strokeWidth="2"
              strokeOpacity="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
            />
          );
        })}
      </svg>

      {demoNodes.map((node, i) => {
        const colors = statusColors[node.status];
        return (
          <motion.div
            key={node.id}
            className="absolute rounded-xl border-2 px-4 py-2 text-center min-w-[80px]"
            style={{
              left: node.x,
              top: node.y,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              boxShadow: colors.glow,
              opacity: node.status === "locked" ? 0.4 : 1,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: node.status === "locked" ? 0.4 : 1 }}
            transition={{ duration: 0.4, delay: i * 0.12, type: "spring" }}
          >
            <span className="text-sm font-medium text-white">{node.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build the landing page**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { HeroTree } from "@/components/landing/hero-tree";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/50 backdrop-blur flex items-center justify-between px-6">
        <span className="text-lg font-bold text-rpg-gold">SkillTree</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition">
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-4 py-1.5 hover:bg-rpg-gold/30 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-4">
          <span className="text-white">Build </span>
          <span className="text-rpg-gold">Skill Trees</span>
          <span className="text-white"> Like a Game</span>
        </h1>
        <p className="text-lg text-slate-400 text-center max-w-xl mb-12">
          Create beautiful, interactive skill trees for any topic. AI generates the structure, you customize every detail. Track progress. Share with anyone.
        </p>

        <HeroTree />

        <div className="mt-12 flex gap-4">
          <Link
            href="/register"
            className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-xl px-8 py-3 text-lg font-medium hover:bg-rpg-gold/30 transition"
          >
            Start Building
          </Link>
          <Link
            href="/login"
            className="bg-rpg-card border border-rpg-border text-slate-300 rounded-xl px-8 py-3 text-lg hover:border-rpg-neon transition"
          >
            Sign In
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-rpg-border flex items-center justify-center">
        <span className="text-xs text-slate-500">Machinity</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify landing page**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run dev
```

Visit http://localhost:3000 — should see hero with animated demo tree, CTA buttons, nav links.

- [ ] **Step 4: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add src/app/page.tsx src/components/landing
git commit -m "feat: add landing page with animated demo skill tree and RPG theme"
```

---

### Task 14: Docker + Deployment

**Files:**
- Create: `Dockerfile`, `~/Desktop/Machinity/landing/skiltree-compose.yml`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile` in project root:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Update next.config.ts for standalone output**

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 3: Create Docker Compose file**

Create `~/Desktop/Machinity/landing/skiltree-compose.yml`:

```yaml
name: skiltree

services:
  app:
    build:
      context: ../aytug/skiltree
      dockerfile: Dockerfile
    container_name: skiltree_app
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://skiltree:skiltree_prod_pw@db:5432/skiltree
      - NEXTAUTH_SECRET=change-this-to-a-secure-random-string
      - NEXTAUTH_URL=https://skiltree.machinity.ai
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    networks:
      - machinity_proxy_net
      - skiltree_internal
    labels:
      - traefik.enable=true
      - traefik.docker.network=machinity_proxy_net
      - traefik.http.routers.skiltree.rule=Host(`skiltree.machinity.ai`) || Host(`www.skiltree.machinity.ai`)
      - traefik.http.routers.skiltree.entrypoints=websecure
      - traefik.http.routers.skiltree.tls=true
      - traefik.http.routers.skiltree.tls.certresolver=le
      - traefik.http.services.skiltree.loadbalancer.server.port=3000
      - traefik.http.routers.skiltree-http.rule=Host(`skiltree.machinity.ai`) || Host(`www.skiltree.machinity.ai`)
      - traefik.http.routers.skiltree-http.entrypoints=web
      - traefik.http.routers.skiltree-http.middlewares=skiltree-redirect
      - traefik.http.middlewares.skiltree-redirect.redirectscheme.scheme=https
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  db:
    image: postgres:16-alpine
    container_name: skiltree_db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=skiltree
      - POSTGRES_PASSWORD=skiltree_prod_pw
      - POSTGRES_DB=skiltree
    volumes:
      - skiltree_pgdata:/var/lib/postgresql/data
    networks:
      - skiltree_internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skiltree"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  skiltree_pgdata:

networks:
  machinity_proxy_net:
    external: true
  skiltree_internal:
    driver: bridge
```

- [ ] **Step 4: Add .dockerignore**

Create `.dockerignore`:

```
node_modules
.next
.git
.env.local
__tests__
docs
```

- [ ] **Step 5: Test Docker build locally**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
docker build -t skiltree-test .
```

Expected: Build completes successfully.

- [ ] **Step 6: Add Prisma migration script for production**

The Docker container needs to run `prisma db push` on first start. Add an entrypoint script.

Create `docker-entrypoint.sh`:

```bash
#!/bin/sh
npx prisma db push --skip-generate
exec node server.js
```

Update Dockerfile's CMD:

Replace the `CMD` line:
```dockerfile
COPY --from=builder /app/docker-entrypoint.sh ./
COPY --from=builder /app/package.json ./

CMD ["sh", "docker-entrypoint.sh"]
```

Make the script executable:

```bash
chmod +x docker-entrypoint.sh
```

- [ ] **Step 7: Commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add Dockerfile .dockerignore docker-entrypoint.sh next.config.ts
git commit -m "feat: add Docker multi-stage build and production compose with Traefik"
```

```bash
cd ~/Desktop/Machinity/landing
git add skiltree-compose.yml
git commit -m "feat: add skiltree compose with Traefik and PostgreSQL"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Run all tests**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm test
```

Expected: All tests pass (status-engine + layout-engine).

- [ ] **Step 2: Run build**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 3: Full manual flow test**

1. `npm run dev`
2. Visit `/` — landing page with animated tree
3. Click "Get Started" — register
4. Redirect to `/dashboard` — empty state
5. Click "New Tree" — enter title + topic + "AI Generate"
6. Redirect to editor with AI-generated nodes
7. Double-click node — detail panel opens, edit fields, save
8. Right-click node — delete
9. Click "Share" — link copied
10. Open link in incognito — read-only public view

- [ ] **Step 4: Deploy (when ready)**

```bash
# Add DNS record: skiltree.machinity.ai -> server IP
# Then:
cd ~/Desktop/Machinity/landing
OPENROUTER_API_KEY=sk-or-v1-... COMPOSE_IGNORE_ORPHANS=1 docker compose -f skiltree-compose.yml up -d --build
```

- [ ] **Step 5: Final commit**

```bash
cd /home/dkmserver/Desktop/Machinity/aytug/skiltree
git add -A
git commit -m "chore: final cleanup and verification"
```
