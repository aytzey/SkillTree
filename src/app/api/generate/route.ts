import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateSkillTree } from "@/lib/openrouter";
import { autoLayout } from "@/lib/layout-engine";
import { toPrismaJson } from "@/lib/prisma-json";

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

  const generated = await generateSkillTree(topic, level || "beginner");

  const titleToId = new Map<string, string>();
  const nodeWidth = 150;
  const nodeHeight = 80;

  const layoutNodes = generated.nodes.map((n, i) => ({ id: `temp-${i}`, width: nodeWidth, height: nodeHeight }));

  const layoutEdges: { source: string; target: string }[] = [];
  for (let i = 0; i < generated.nodes.length; i++) {
    for (const depTitle of generated.nodes[i].dependencies) {
      const depIndex = generated.nodes.findIndex((n) => n.title.toLowerCase() === depTitle.toLowerCase());
      if (depIndex >= 0) {
        layoutEdges.push({ source: `temp-${depIndex}`, target: `temp-${i}` });
      }
    }
  }

  const positions = autoLayout(layoutNodes, layoutEdges);

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
        subTasks: toPrismaJson(gn.subTasks || []),
        resources: toPrismaJson(gn.resources || []),
      },
    });

    titleToId.set(gn.title.toLowerCase(), node.id);
  }

  for (const gn of generated.nodes) {
    const targetId = titleToId.get(gn.title.toLowerCase());
    if (!targetId) continue;

    for (const depTitle of gn.dependencies) {
      const sourceId = titleToId.get(depTitle.toLowerCase());
      if (!sourceId) continue;

      await prisma.skillEdge.create({
        data: { treeId, sourceNodeId: sourceId, targetNodeId: targetId, type: "prerequisite" },
      });
    }
  }

  return NextResponse.json({ ok: true, nodeCount: generated.nodes.length });
}
