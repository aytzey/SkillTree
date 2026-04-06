import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { mergeNodeUpdates } from "@/lib/tree-editor-utils";
import { toPrismaJson } from "@/lib/prisma-json";

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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const targetNodes = nodeId ? graph.nodes.filter((node) => node.id === nodeId) : graph.nodes;
  if (targetNodes.length === 0) {
    return NextResponse.json({ error: "No nodes found" }, { status: 404 });
  }

  const treeContext = graph.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    difficulty: node.difficulty,
    estimatedHours: node.estimatedHours,
    subTasks: node.subTasks,
    resources: node.resources,
  }));

  const systemPrompt = `You are an expert education designer. You will be given a skill tree and specific nodes to enhance.
Your job is to improve each node's content to be more detailed, actionable, and useful for a learner.

For each node, improve:
- description: Make it clear, specific, and motivating (2-3 sentences)
- subTasks: Break down into concrete, actionable steps (3-5 sub-tasks). Keep existing done states.
- resources: Add real, useful learning resources with valid URLs (2-4 resources)
- estimatedHours: Provide a realistic estimate
- difficulty: Adjust if needed (1=trivial, 2=easy, 3=medium, 4=hard, 5=expert)

Return ONLY valid JSON with this structure:
{
  "enhanced": [
    {
      "id": "original node id",
      "description": "improved description",
      "difficulty": 3,
      "estimatedHours": 10,
      "subTasks": [{"title": "concrete step", "done": false}],
      "resources": [{"title": "resource name", "url": "https://..."}]
    }
  ]
}

Do NOT change the node title, id, or positions.`;

  const userPrompt = `Tree topic: "${graph.title}"

Full tree context (all nodes):
${JSON.stringify(treeContext, null, 2)}

Nodes to enhance:
${JSON.stringify(targetNodes, null, 2)}

Enhance ${nodeId ? "this specific node" : "all nodes"} to be more detailed and useful. Return only JSON.`;

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
