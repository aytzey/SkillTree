import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { findAvailableNodePosition } from "@/lib/tree-editor-utils";
import { toPrismaJson } from "@/lib/prisma-json";

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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const treeContext = graph.nodes
    .map((node) => `- ${node.title}${node.description ? `: ${node.description}` : ""}`)
    .join("\n");

  const directionPrompts: Record<string, string> = {
    above: `Suggest a PREREQUISITE roadmap item that should happen BEFORE "${targetNode.title}". Make it a foundational goal, requirement, or milestone that this item depends on.`,
    below: `Suggest a FOLLOW-UP roadmap item that should happen AFTER "${targetNode.title}". Make it a logical next milestone, deliverable, or execution step unlocked by it.`,
    parallel: `Suggest a PARALLEL roadmap item at the same level as "${targetNode.title}". Make it a complementary workstream or milestone in the same phase, not a dependency of it.`,
  };

  const systemPrompt = `You are an expert project planner. You will suggest a single new roadmap item for a project roadmap.

Return ONLY valid JSON with this exact structure:
{
  "title": "Roadmap item title (concise, 2-4 words)",
  "description": "Goal, requirement, or milestone covered by this roadmap item (2-3 sentences)",
  "difficulty": 3,
  "estimatedHours": 5,
  "subTasks": [{"title": "concrete step", "done": false}],
  "resources": [{"title": "resource name", "url": "https://..."}]
}

Rules:
- Title must be unique (not already in the roadmap)
- difficulty: 1=trivial, 2=easy, 3=medium, 4=hard, 5=expert
- 3-5 sub-tasks describing concrete execution steps or next actions
- 1-3 real resources with valid URLs
- Make it specific, actionable, and consistent with the requested dependency direction`;

  const userPrompt = `Roadmap topic: "${graph.title}"

Existing roadmap items:
${treeContext}

Current roadmap item: "${targetNode.title}" (difficulty: ${targetNode.difficulty}, description: ${targetNode.description || "none"})

${directionPrompts[direction]}

Return only JSON.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `AI error: ${response.status}` }, { status: 500 });
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

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
