import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { findAvailableNodePosition } from "@/lib/tree-editor-utils";
import { toPrismaJson } from "@/lib/prisma-json";
import { requestOpenRouterJson } from "@/lib/openrouter";
import { buildRoadmapSuggestionPrompts } from "@/lib/roadmap-ai-prompts";

export async function POST(req: NextRequest) {
  const { treeId, nodeId, direction, preferredPositionX, preferredPositionY } = await req.json();
  if (!treeId || !nodeId || !direction) {
    return NextResponse.json({ error: "treeId, nodeId, and direction required" }, { status: 400 });
  }

  if (!["above", "below", "parallel"].includes(direction)) {
    return NextResponse.json({ error: "direction must be above, below, or parallel" }, { status: 400 });
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

  const targetNode = graph.nodes.find((node) => node.id === nodeId);
  if (!targetNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
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

  const promptTargetNode = promptNodes.find((node) => node.id === nodeId);
  if (!promptTargetNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const prompts = buildRoadmapSuggestionPrompts({
    roadmapTitle: graph.title,
    targetNode: promptTargetNode,
    nodes: promptNodes,
    edges: promptEdges,
    direction,
  });

  let content: string;
  try {
    content = await requestOpenRouterJson({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      temperature: 0.55,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI error" },
      { status: 500 }
    );
  }

  let suggested: {
    title: string;
    description: string;
    difficulty: number;
    estimatedHours: number;
    subTasks: Array<{ title: string; done: boolean }>;
    resources: Array<{ title: string; url: string }>;
  };

  try {
    suggested = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  const fallbackPosition = findAvailableNodePosition(graph.nodes, {
    anchorNodeId: nodeId,
    direction,
  });
  const requestedPosition = Number.isFinite(preferredPositionX) && Number.isFinite(preferredPositionY)
    ? {
        x: Math.round(Number(preferredPositionX) / 50) * 50,
        y: Math.round(Number(preferredPositionY) / 50) * 50,
      }
    : fallbackPosition;

  const node = await prisma.skillNode.create({
    data: {
      treeId,
      title: suggested.title,
      description: suggested.description,
      difficulty: Math.min(5, Math.max(1, suggested.difficulty || 3)),
      estimatedHours: suggested.estimatedHours || null,
      positionX: requestedPosition.x,
      positionY: requestedPosition.y,
      subTasks: toPrismaJson(suggested.subTasks || []),
      resources: toPrismaJson(suggested.resources || []),
    },
  });

  let edge = null;
  if (direction === "above") {
    edge = await prisma.skillEdge.create({
      data: { treeId, sourceNodeId: node.id, targetNodeId: nodeId, type: "prerequisite" },
    });
  } else if (direction === "below") {
    edge = await prisma.skillEdge.create({
      data: { treeId, sourceNodeId: nodeId, targetNodeId: node.id, type: "prerequisite" },
    });
  }

  return NextResponse.json({ node, edge });
}
