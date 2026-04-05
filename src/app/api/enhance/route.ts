import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, nodeId } = await req.json();
  if (!treeId) {
    return NextResponse.json({ error: "treeId required" }, { status: 400 });
  }

  const tree = await prisma.skillTree.findUnique({
    where: { id: treeId },
    include: { nodes: true, edges: true },
  });
  if (!tree || tree.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  // Determine which nodes to enhance
  const targetNodes = nodeId
    ? tree.nodes.filter((n) => n.id === nodeId)
    : tree.nodes;

  if (targetNodes.length === 0) {
    return NextResponse.json({ error: "No nodes found" }, { status: 404 });
  }

  const treeContext = tree.nodes.map((n) => ({
    title: n.title,
    description: n.description,
    difficulty: n.difficulty,
    estimatedHours: n.estimatedHours,
    subTasks: n.subTasks,
    resources: n.resources,
  }));

  const nodesToEnhance = targetNodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    difficulty: n.difficulty,
    estimatedHours: n.estimatedHours,
    subTasks: n.subTasks,
    resources: n.resources,
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

Do NOT change the node title or id. Keep existing subTask done states if they exist.`;

  const userPrompt = `Tree topic: "${tree.title}"

Full tree context (all nodes):
${JSON.stringify(treeContext, null, 2)}

Nodes to enhance:
${JSON.stringify(nodesToEnhance, null, 2)}

Enhance ${nodeId ? "this specific node" : "all nodes"} to be more detailed and useful. Return only JSON.`;

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
    return NextResponse.json({ error: `AI error: ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  let parsed: { enhanced: Array<{
    id: string;
    description: string;
    difficulty: number;
    estimatedHours: number;
    subTasks: Array<{ title: string; done: boolean }>;
    resources: Array<{ title: string; url: string }>;
  }> };

  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // Apply enhancements to database
  for (const enhanced of parsed.enhanced) {
    const existing = tree.nodes.find((n) => n.id === enhanced.id);
    if (!existing) continue;

    await prisma.skillNode.update({
      where: { id: enhanced.id },
      data: {
        description: enhanced.description || existing.description,
        difficulty: Math.min(5, Math.max(1, enhanced.difficulty || existing.difficulty)),
        estimatedHours: enhanced.estimatedHours || existing.estimatedHours,
        subTasks: enhanced.subTasks || existing.subTasks,
        resources: enhanced.resources || existing.resources,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    enhancedCount: parsed.enhanced.length,
  });
}
