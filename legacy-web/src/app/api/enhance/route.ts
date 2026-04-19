import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { mergeNodeUpdates } from "@/lib/tree-editor-utils";
import { toPrismaJson } from "@/lib/prisma-json";
import { requestOpenRouterJson } from "@/lib/openrouter";
import { buildRoadmapEnhancementPrompts } from "@/lib/roadmap-ai-prompts";

export async function POST(req: NextRequest) {
  const { treeId, nodeId } = await req.json();
  if (!treeId) {
    return NextResponse.json({ error: "treeId required" }, { status: 400 });
  }

  const { tree, access } = await getTreeRouteAccessById(req, treeId);
  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access?.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const graph = await prisma.skillTree.findUnique({
    where: { id: treeId },
    include: { nodes: true, edges: true },
  });

  if (!graph) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetNodes = nodeId ? graph.nodes.filter((node) => node.id === nodeId) : graph.nodes;
  if (targetNodes.length === 0) {
    return NextResponse.json({ error: "No nodes found" }, { status: 404 });
  }

  const promptNodes = graph.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    difficulty: node.difficulty,
    estimatedHours: node.estimatedHours,
    subTasks: (node.subTasks as Array<{ title: string; done: boolean }> | null) || [],
    resources: (node.resources as Array<{ title: string; url: string }> | null) || [],
  }));
  const promptEdges = graph.edges.map((edge) => ({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    type: edge.type,
  }));
  const promptTargets = promptNodes.filter((node) => targetNodes.some((target) => target.id === node.id));

  const prompts = buildRoadmapEnhancementPrompts({
    roadmapTitle: graph.title,
    targetNodes: promptTargets,
    nodes: promptNodes,
    edges: promptEdges,
  });

  let content: string;
  try {
    content = await requestOpenRouterJson({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      temperature: 0.35,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI error" },
      { status: 500 }
    );
  }

  let parsed: {
    enhanced: Array<{
      id: string;
      description: string;
      difficulty: number;
      estimatedHours: number;
      subTasks: Array<{ title: string; done: boolean }>;
      resources: Array<{ title: string; url: string }>;
    }>;
  };

  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  const mergedNodes = mergeNodeUpdates(
    graph.nodes.map((node) => ({
      ...node,
      status: node.status as "locked" | "available" | "in_progress" | "completed",
      subTasks: (node.subTasks as Array<{ title: string; done: boolean }>) || [],
      resources: (node.resources as Array<{ title: string; url: string }>) || [],
      style: node.style as Record<string, unknown> | null,
    })),
    parsed.enhanced.map((enhanced) => ({
      id: enhanced.id,
      description: enhanced.description,
      difficulty: Math.min(5, Math.max(1, enhanced.difficulty || 1)),
      estimatedHours: enhanced.estimatedHours,
      subTasks: enhanced.subTasks,
      resources: enhanced.resources,
    }))
  );

  const updatesById = new Map(mergedNodes.map((node) => [node.id, node]));

  for (const enhanced of parsed.enhanced) {
    const nextNode = updatesById.get(enhanced.id);
    if (!nextNode) continue;

    await prisma.skillNode.update({
      where: { id: enhanced.id },
      data: {
        description: nextNode.description,
        difficulty: nextNode.difficulty,
        estimatedHours: nextNode.estimatedHours,
        subTasks: toPrismaJson(nextNode.subTasks),
        resources: toPrismaJson(nextNode.resources),
      },
    });
  }

  const enhancedNodes = mergedNodes.filter((node) => parsed.enhanced.some((item) => item.id === node.id));

  return NextResponse.json({
    ok: true,
    enhancedCount: enhancedNodes.length,
    nodes: enhancedNodes,
  });
}
