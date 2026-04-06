import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTreeRouteAccessById } from "@/lib/tree-route-access";
import { generateSubTree } from "@/lib/openrouter";
import { autoLayout } from "@/lib/layout-engine";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(req: NextRequest) {
  const { treeId, nodeId, maxDepth } = await req.json();
  if (!treeId || !nodeId) {
    return NextResponse.json({ error: "treeId and nodeId required" }, { status: 400 });
  }

  const depth = Math.min(5, Math.max(1, maxDepth || 2));

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

  const anchorNode = graph.nodes.find((n) => n.id === nodeId);
  if (!anchorNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const generated = await generateSubTree({
    treeTopic: graph.title,
    anchorNode: {
      title: anchorNode.title,
      description: anchorNode.description,
      difficulty: anchorNode.difficulty,
    },
    existingNodes: graph.nodes.map((n) => ({
      title: n.title,
      description: n.description,
    })),
    maxDepth: depth,
  });

  // Build layout including existing nodes + new nodes
  const nodeWidth = 150;
  const nodeHeight = 80;

  // Existing nodes for layout context
  const layoutNodes = graph.nodes.map((n) => ({
    id: n.id,
    width: nodeWidth,
    height: nodeHeight,
  }));

  const layoutEdges = graph.edges.map((e) => ({
    source: e.sourceNodeId,
    target: e.targetNodeId,
  }));

  // Add generated nodes to layout
  const titleToTempId = new Map<string, string>();
  for (let i = 0; i < generated.nodes.length; i++) {
    const tempId = `subtree-${i}`;
    titleToTempId.set(generated.nodes[i].title.toLowerCase(), tempId);
    layoutNodes.push({ id: tempId, width: nodeWidth, height: nodeHeight });
  }

  // Map existing node titles to their real IDs for dependency resolution
  const existingTitleToId = new Map<string, string>();
  for (const n of graph.nodes) {
    existingTitleToId.set(n.title.toLowerCase(), n.id);
  }

  // Add edges from generated dependencies
  for (let i = 0; i < generated.nodes.length; i++) {
    const gn = generated.nodes[i];
    const targetTempId = `subtree-${i}`;

    for (const depTitle of gn.dependencies) {
      const depLower = depTitle.toLowerCase();
      // Check if dependency is an existing node
      const existingId = existingTitleToId.get(depLower);
      if (existingId) {
        layoutEdges.push({ source: existingId, target: targetTempId });
        continue;
      }
      // Check if dependency is another generated node
      const tempId = titleToTempId.get(depLower);
      if (tempId) {
        layoutEdges.push({ source: tempId, target: targetTempId });
      }
    }
  }

  const positions = autoLayout(layoutNodes, layoutEdges);

  // Create nodes in database
  const createdNodes = [];
  const titleToRealId = new Map<string, string>(existingTitleToId);

  for (let i = 0; i < generated.nodes.length; i++) {
    const gn = generated.nodes[i];
    const tempId = `subtree-${i}`;
    const pos = positions.get(tempId) || {
      x: anchorNode.positionX + (i % 3 - 1) * 200,
      y: anchorNode.positionY + 200 + Math.floor(i / 3) * 200,
    };

    const node = await prisma.skillNode.create({
      data: {
        treeId,
        title: gn.title,
        description: gn.description,
        difficulty: Math.min(5, Math.max(1, gn.difficulty)),
        estimatedHours: gn.estimatedHours || null,
        positionX: pos.x,
        positionY: pos.y,
        subTasks: toPrismaJson(gn.subTasks || []),
        resources: toPrismaJson(gn.resources || []),
      },
    });

    titleToRealId.set(gn.title.toLowerCase(), node.id);
    createdNodes.push(node);
  }

  // Create edges
  const createdEdges = [];
  for (const gn of generated.nodes) {
    const targetId = titleToRealId.get(gn.title.toLowerCase());
    if (!targetId) continue;

    for (const depTitle of gn.dependencies) {
      const sourceId = titleToRealId.get(depTitle.toLowerCase());
      if (!sourceId || sourceId === targetId) continue;

      const edge = await prisma.skillEdge.create({
        data: { treeId, sourceNodeId: sourceId, targetNodeId: targetId, type: "prerequisite" },
      });
      createdEdges.push(edge);
    }
  }

  return NextResponse.json({
    ok: true,
    nodeCount: createdNodes.length,
    edgeCount: createdEdges.length,
    nodes: createdNodes,
    edges: createdEdges,
  });
}
