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
