export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

export interface RoadmapGenerationPromptInput {
  topic: string;
  level?: string | null;
  context?: string | null;
}

export interface RoadmapContextQuestionsPromptInput {
  title: string;
  topic: string;
}

export interface RoadmapSubTask {
  title: string;
  done: boolean;
}

export interface RoadmapResource {
  title: string;
  url: string;
}

export interface RoadmapPromptNode {
  id: string;
  title: string;
  description: string | null;
  difficulty: number;
  estimatedHours: number | null;
  subTasks?: RoadmapSubTask[] | null;
  resources?: RoadmapResource[] | null;
}

export interface RoadmapPromptEdge {
  sourceNodeId: string;
  targetNodeId: string;
  type?: string | null;
}

export interface RoadmapSubTreePromptInput {
  treeTopic: string;
  anchorNode: { title: string; description: string | null; difficulty: number };
  existingNodes: Array<{ title: string; description: string | null }>;
  maxDepth: number;
}

export type SuggestDirection = "above" | "below" | "parallel";

export interface RoadmapSuggestionPromptInput {
  roadmapTitle: string;
  targetNode: RoadmapPromptNode;
  nodes: RoadmapPromptNode[];
  edges: RoadmapPromptEdge[];
  direction: SuggestDirection;
}

export interface RoadmapEnhancementPromptInput {
  roadmapTitle: string;
  targetNodes: RoadmapPromptNode[];
  nodes: RoadmapPromptNode[];
  edges: RoadmapPromptEdge[];
}

interface GraphIndex {
  incomingByNodeId: Map<string, string[]>;
  outgoingByNodeId: Map<string, string[]>;
  peerByNodeId: Map<string, string[]>;
}

export function buildRoadmapGenerationPrompts(input: RoadmapGenerationPromptInput): PromptPair {
  const topic = input.topic.trim();
  const level = input.level?.trim();
  const contextLines = splitContextLines(input.context);

  return {
    systemPrompt: [
      "ROLE",
      "You are a staff-level roadmap architect for software, product, learning, and delivery projects.",
      "Design a realistic roadmap as a dependency-aware directed acyclic graph, not a brainstorm list.",
      "",
      "OUTPUT CONTRACT",
      "Return ONLY valid JSON with this exact structure:",
      "{",
      '  "nodes": [',
      "    {",
      '      "title": "Short unique roadmap item title",',
      '      "description": "2-3 sentences explaining the outcome, why it matters, and what it unlocks",',
      '      "difficulty": 3,',
      '      "estimatedHours": 8,',
      '      "subTasks": [{"title": "Concrete action", "done": false}],',
      '      "resources": [{"title": "Canonical resource", "url": "https://..."}],',
      '      "dependencies": ["Exact title of prerequisite node"]',
      "    }",
      "  ]",
      "}",
      "",
      "QUALITY RULES",
      "- Create 10-18 roadmap items.",
      "- Each title must be unique, concrete, and 2-6 words. Avoid vague titles like \"Implementation\", \"Polish\", or \"Misc\" unless qualified.",
      "- Each description must state the deliverable or outcome, why it matters, and what completion unlocks.",
      "- difficulty must be an integer from 1-5.",
      "- estimatedHours must be a realistic integer effort estimate for that item.",
      "- Provide 2-4 subTasks per node. Each subTask should start with a strong verb and represent an actionable next step.",
      "- Provide 1-3 real resources with valid HTTPS URLs. Prefer official docs, canonical guides, or credible implementation references. Never invent placeholder links, fake domains, or example.com-style URLs.",
      "- Keep node granularity consistent. Avoid epic-sized umbrella items and tiny checklist crumbs.",
      "",
      "GRAPH RULES",
      "- Build 2-4 parallel workstreams where the topic allows it.",
      "- Include at least 2 root nodes with empty dependencies.",
      "- Include both divergence and convergence where it makes sense.",
      "- Avoid a linear chain longer than 3 nodes without a branch.",
      "- Dependencies may only reference exact titles that exist in the final JSON.",
      "- Do not create cycles, dangling dependencies, or duplicate work expressed under different titles.",
      "- Order nodes roughly from earliest to latest so dependencies point backward in the list whenever possible.",
      "",
      "SCOPE RULES",
      "- Tailor scope to the user's starting point, timeline, and experience level.",
      "- If context indicates an existing project or prototype, focus on the missing roadmap from that point forward instead of restarting from zero.",
      "- If context indicates a learning goal, include practical validation or project milestones instead of theory-only steps.",
      "- Use domain terminology that fits the topic, but do not introduce unnecessary technology choices that were not implied by the prompt.",
      "",
      "FINAL CHECK",
      "Internally verify that the roadmap is specific, non-redundant, dependency-valid, and genuinely parallelized.",
      "Return JSON only. No markdown, prose, or code fences.",
    ].join("\n"),
    userPrompt: [
      `Roadmap topic: "${topic}"`,
      "",
      "Planner context:",
      `- Preferred experience level: ${level || "not specified"}`,
      ...(contextLines.length > 0
        ? contextLines.map((line) => `- ${line}`)
        : ["- Additional context: none provided"]),
      "",
      "Use the context above as planning constraints for scope, terminology, and sequencing.",
      "Balance foundations, execution, validation, and delivery at the appropriate level of detail.",
      "Return only JSON.",
    ].join("\n"),
  };
}

export function buildRoadmapContextQuestionsPrompts(
  input: RoadmapContextQuestionsPromptInput
): PromptPair {
  return {
    systemPrompt: [
      "ROLE",
      "You are an expert roadmap discovery strategist.",
      "Your job is to ask the user a short set of multiple-choice discovery questions before roadmap generation.",
      "",
      "OUTPUT CONTRACT",
      "Return ONLY valid JSON with this exact structure:",
      "{",
      '  "questions": [',
      "    {",
      '      "id": "short_snake_case_id",',
      '      "label": "User-facing question text?",',
      '      "summaryLabel": "Short summary label",',
      '      "multi": false,',
      '      "options": [',
      '        {"value": "short_option_id", "label": "Option label", "desc": "Optional short helper text"}',
      "      ]",
      "    }",
      "  ]",
      "}",
      "",
      "QUESTION RULES",
      "- Generate exactly 3 or 4 questions.",
      "- Every question must be materially useful for planning this specific roadmap, not generic filler.",
      "- Tailor the questions to the roadmap title and description. Domain-specific questions are preferred when they change the roadmap shape.",
      "- Do not ask for information already explicitly stated in the user's title or description.",
      "- Prioritize unanswered factors that change scope, sequencing, effort, or dependency structure.",
      "- At least one question should cover current state, constraints, target outcome, audience, deployment shape, or success criteria when relevant.",
      "- Questions must be multiple-choice only. No freeform prompts in the JSON.",
      "- Each question must have 3-4 options.",
      "- Options should be concrete, distinct, and easy to choose from. Avoid overlapping wording.",
      "- `summaryLabel` should be short and suitable for context summaries like `Timeline: 2-4 weeks`.",
      "- `id` and option `value` fields must be lowercase snake_case.",
      "- Keep helper descriptions short and informative.",
      "",
      "QUALITY BAR",
      "- If the roadmap is about a technical skill or project, ask about the technical choices or constraints most likely to change the plan.",
      "- If the roadmap is about learning, ask about prior experience, target depth, or practical outcome.",
      "- If the roadmap is about building, ask about delivery scope, environment, or operational constraints.",
      "- Avoid repeating the same idea across multiple questions.",
      "",
      "FINAL CHECK",
      "Internally verify the questions are specific, diverse, and planning-relevant.",
      "Return JSON only. No markdown, prose, or code fences.",
    ].join("\n"),
    userPrompt: [
      `Roadmap title: "${input.title.trim()}"`,
      `Roadmap description: "${input.topic.trim()}"`,
      "",
      "Generate the best discovery questions to refine roadmap planning for this exact goal.",
      "Return only JSON.",
    ].join("\n"),
  };
}

export function buildRoadmapSubTreePrompts(input: RoadmapSubTreePromptInput): PromptPair {
  const nodesPerDepth = input.maxDepth <= 2 ? "3-5" : "2-4";
  const totalEstimate = input.maxDepth <= 2
    ? `${input.maxDepth * 3}-${input.maxDepth * 5}`
    : `${input.maxDepth * 2}-${input.maxDepth * 4}`;

  return {
    systemPrompt: [
      "ROLE",
      "You are a staff-level roadmap architect expanding one roadmap item into a dependency-valid child sub-roadmap.",
      "",
      "OUTPUT CONTRACT",
      "Return ONLY valid JSON with this exact structure:",
      "{",
      '  "nodes": [',
      "    {",
      '      "title": "Short unique child roadmap item title",',
      '      "description": "2-3 sentences explaining the child outcome, why it matters, and what it unlocks",',
      '      "difficulty": 3,',
      '      "estimatedHours": 6,',
      '      "subTasks": [{"title": "Concrete action", "done": false}],',
      '      "resources": [{"title": "Canonical resource", "url": "https://..."}],',
      '      "dependencies": ["Exact title of prerequisite node"]',
      "    }",
      "  ]",
      "}",
      "",
      "STRUCTURE RULES",
      `- Generate roughly ${totalEstimate} new nodes across ${input.maxDepth} depth levels.`,
      `- Aim for ${nodesPerDepth} nodes per layer when the topic naturally supports that density.`,
      `- Every generated title must be unique and must not duplicate the anchor title or any existing roadmap item.`,
      "- Each generated node must be a descendant step of the anchor, not a restatement of the anchor itself.",
      `- FIRST-LAYER nodes must depend on exactly ["${input.anchorNode.title}"].`,
      "- Deeper nodes must depend on at least one earlier generated node. Use multiple dependencies when convergence is real.",
      "- Create parallel branches inside the sub-tree where possible. Avoid turning the expansion into a single chain.",
      "- Order nodes roughly from shallower layers to deeper layers so dependency references point backward when possible.",
      "",
      "QUALITY RULES",
      "- Match the anchor node's scope and domain language.",
      "- Use concrete 2-6 word titles and actionable 2-3 sentence descriptions.",
      "- difficulty must be an integer from 1-5 and should stay realistic relative to the anchor difficulty.",
      "- Provide 2-4 verb-led subTasks per node.",
      "- Provide 1-3 real resources with valid HTTPS URLs. Prefer official or canonical material. Never invent placeholder links.",
      "- Do not create cycles, dangling dependencies, or duplicate work already represented elsewhere in the roadmap.",
      "",
      "FINAL CHECK",
      "Internally verify that the sub-tree adds missing child workstreams, preserves dependency logic, and fits naturally under the anchor node.",
      "Return JSON only. No markdown, prose, or code fences.",
    ].join("\n"),
    userPrompt: [
      `Roadmap topic: "${input.treeTopic}"`,
      "",
      "Anchor node to expand:",
      `- Title: ${input.anchorNode.title}`,
      `- Description: ${input.anchorNode.description || "none"}`,
      `- Difficulty: ${input.anchorNode.difficulty}`,
      `- Requested depth levels: ${input.maxDepth}`,
      "",
      "Existing roadmap items that must not be duplicated:",
      ...formatExistingTitles(input.existingNodes),
      "",
      "Break the anchor into child workstreams that are meaningfully parallel where possible.",
      "Return only JSON.",
    ].join("\n"),
  };
}

export function buildRoadmapSuggestionPrompts(input: RoadmapSuggestionPromptInput): PromptPair {
  const graphIndex = buildGraphIndex(input.nodes, input.edges);
  const directionInstruction = getDirectionInstruction(input.direction, input.targetNode.title);

  return {
    systemPrompt: [
      "ROLE",
      "You are an expert roadmap editor adding exactly one missing roadmap item to strengthen an existing roadmap.",
      "",
      "OUTPUT CONTRACT",
      "Return ONLY valid JSON with this exact structure:",
      "{",
      '  "title": "Short unique roadmap item title",',
      '  "description": "2-3 sentences explaining the outcome, why it matters, and how it relates to the target node",',
      '  "difficulty": 3,',
      '  "estimatedHours": 6,',
      '  "subTasks": [{"title": "Concrete action", "done": false}],',
      '  "resources": [{"title": "Canonical resource", "url": "https://..."}]',
      "}",
      "",
      "DIRECTION SEMANTICS",
      "- above: suggest a missing prerequisite that should exist before the target node and is not already covered by current incoming links.",
      "- below: suggest the next meaningful milestone unlocked by the target node, not a distant future phase.",
      "- parallel: suggest a same-phase complementary workstream. It should relate to the same area of work without being a prerequisite or dependent of the target node.",
      "",
      "QUALITY RULES",
      "- Suggest exactly one roadmap item.",
      "- The title must be unique, concrete, and 2-6 words.",
      "- Match the granularity of the target node and its nearby nodes. Do not propose an epic-level umbrella item or a tiny checklist step.",
      "- Make the description specific to the roadmap context instead of generic filler text.",
      "- difficulty must be an integer from 1-5 and estimatedHours must be a realistic integer.",
      "- Provide 3-5 verb-led subTasks.",
      "- Provide 1-3 real resources with valid HTTPS URLs. Prefer official or canonical references. Never invent placeholder links.",
      "- Do not duplicate or lightly rename any existing roadmap item.",
      "- If multiple ideas fit, choose the one that adds the most structural value around the target node.",
      "",
      "FINAL CHECK",
      "Internally verify that the suggestion is unique, well-scoped, and correct for the requested direction.",
      "Return JSON only. No markdown, prose, or code fences.",
    ].join("\n"),
    userPrompt: [
      `Roadmap topic: "${input.roadmapTitle}"`,
      "",
      "Target node:",
      ...formatNodeDetailBlock(input.targetNode, graphIndex),
      "",
      "Roadmap inventory:",
      ...formatRoadmapInventory(input.nodes, graphIndex),
      "",
      `Request: ${directionInstruction}`,
      "Select one missing roadmap item that fits the existing vocabulary, sequence, and level of detail.",
      "Return only JSON.",
    ].join("\n"),
  };
}

export function buildRoadmapEnhancementPrompts(input: RoadmapEnhancementPromptInput): PromptPair {
  const graphIndex = buildGraphIndex(input.nodes, input.edges);

  return {
    systemPrompt: [
      "ROLE",
      "You are an expert roadmap editor improving existing roadmap items without changing the graph's meaning.",
      "",
      "OUTPUT CONTRACT",
      "Return ONLY valid JSON with this exact structure:",
      "{",
      '  "enhanced": [',
      "    {",
      '      "id": "original node id",',
      '      "description": "Improved 2-3 sentence description",',
      '      "difficulty": 3,',
      '      "estimatedHours": 8,',
      '      "subTasks": [{"title": "Concrete action", "done": false}],',
      '      "resources": [{"title": "Canonical resource", "url": "https://..."}]',
      "    }",
      "  ]",
      "}",
      "",
      "PRESERVATION RULES",
      "- Keep each original id exactly as provided.",
      "- Do not change titles, ids, positions, or dependency meaning.",
      "- Preserve completed work. If an existing subTask is done=true, carry it forward as done=true and keep its intent intact.",
      "- Keep each node at the same roadmap granularity. Do not turn a milestone into an epic or a tiny checklist.",
      "- Do not introduce content that contradicts incoming or outgoing links.",
      "",
      "IMPROVEMENT RULES",
      "- Improve the description so it explains the outcome, why it matters, and what completion should make possible.",
      "- difficulty must be an integer from 1-5 and estimatedHours must be a realistic integer.",
      "- Provide 3-5 concrete, verb-led subTasks in a sensible execution order.",
      "- Provide 2-4 real resources with valid HTTPS URLs. Prefer official docs, standards, templates, or canonical references. Never invent placeholder links.",
      "- When current content is already good, refine it lightly instead of rewriting for style only.",
      "- Match terminology used across the roadmap.",
      "",
      "FINAL CHECK",
      "Internally verify that each enhancement makes the node clearer and more actionable while preserving graph semantics.",
      "Return JSON only. No markdown, prose, or code fences.",
    ].join("\n"),
    userPrompt: [
      `Roadmap topic: "${input.roadmapTitle}"`,
      "",
      "Roadmap inventory:",
      ...formatRoadmapInventory(input.nodes, graphIndex),
      "",
      "Nodes to enhance:",
      ...input.targetNodes.flatMap((node) => [...formatNodeDetailBlock(node, graphIndex), ""]),
      "Use the roadmap inventory and each node's relationship context to keep enhancements aligned with the graph.",
      "Return only JSON.",
    ].join("\n"),
  };
}

function splitContextLines(value: string | null | undefined) {
  return (value || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatExistingTitles(nodes: Array<{ title: string; description: string | null }>) {
  if (nodes.length === 0) return ["- none"];

  return nodes.map((node) => (
    `- ${node.title}${node.description ? `: ${truncate(node.description, 120)}` : ""}`
  ));
}

function buildGraphIndex(nodes: RoadmapPromptNode[], edges: RoadmapPromptEdge[]): GraphIndex {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incomingByNodeId = new Map<string, string[]>();
  const outgoingByNodeId = new Map<string, string[]>();
  const peerByNodeId = new Map<string, string[]>();

  for (const node of nodes) {
    incomingByNodeId.set(node.id, []);
    outgoingByNodeId.set(node.id, []);
    peerByNodeId.set(node.id, []);
  }

  for (const edge of edges) {
    const source = nodeById.get(edge.sourceNodeId);
    const target = nodeById.get(edge.targetNodeId);
    if (!source || !target) continue;

    const label = edge.type || "prerequisite";
    outgoingByNodeId.get(source.id)?.push(`${target.title} [${label}]`);
    incomingByNodeId.get(target.id)?.push(`${source.title} [${label}]`);
  }

  const rootNodes = nodes.filter((node) => (incomingByNodeId.get(node.id) || []).length === 0);
  for (const node of rootNodes) {
    const peers = rootNodes
      .filter((candidate) => candidate.id !== node.id)
      .map((candidate) => candidate.title);
    peerByNodeId.set(node.id, peers);
  }

  const prerequisiteEdges = edges.filter((edge) => (edge.type || "prerequisite") === "prerequisite");
  const prerequisiteTargetsBySource = new Map<string, string[]>();

  for (const edge of prerequisiteEdges) {
    const targets = prerequisiteTargetsBySource.get(edge.sourceNodeId) || [];
    targets.push(edge.targetNodeId);
    prerequisiteTargetsBySource.set(edge.sourceNodeId, targets);
  }

  for (const node of nodes) {
    if ((peerByNodeId.get(node.id) || []).length > 0) continue;

    const siblingSet = new Set<string>();
    for (const edge of prerequisiteEdges) {
      if (edge.targetNodeId !== node.id) continue;

      for (const targetId of prerequisiteTargetsBySource.get(edge.sourceNodeId) || []) {
        if (targetId === node.id) continue;
        const sibling = nodeById.get(targetId);
        if (sibling) siblingSet.add(sibling.title);
      }
    }

    peerByNodeId.set(node.id, Array.from(siblingSet));
  }

  return { incomingByNodeId, outgoingByNodeId, peerByNodeId };
}

function formatRoadmapInventory(nodes: RoadmapPromptNode[], graphIndex: GraphIndex) {
  if (nodes.length === 0) return ["- none"];

  return nodes.map((node) => (
    `- ${node.title} [${node.id}] | difficulty ${node.difficulty} | hours ${formatHours(node.estimatedHours)} | incoming: ${formatInlineList(graphIndex.incomingByNodeId.get(node.id) || [])} | outgoing: ${formatInlineList(graphIndex.outgoingByNodeId.get(node.id) || [])} | summary: ${truncate(node.description || "none", 120)}`
  ));
}

function formatNodeDetailBlock(node: RoadmapPromptNode, graphIndex: GraphIndex) {
  return [
    `- [${node.id}] ${node.title}`,
    `  Description: ${node.description || "none"}`,
    `  Difficulty: ${node.difficulty}`,
    `  Estimated hours: ${formatHours(node.estimatedHours)}`,
    `  Incoming links: ${formatInlineList(graphIndex.incomingByNodeId.get(node.id) || [])}`,
    `  Outgoing links: ${formatInlineList(graphIndex.outgoingByNodeId.get(node.id) || [])}`,
    `  Same-phase peers: ${formatInlineList(graphIndex.peerByNodeId.get(node.id) || [])}`,
    `  Current subtasks: ${formatSubTasks(node.subTasks || [])}`,
    `  Current resources: ${formatResources(node.resources || [])}`,
  ];
}

function formatSubTasks(subTasks: RoadmapSubTask[]) {
  if (subTasks.length === 0) return "none";
  return subTasks
    .map((subTask) => `${subTask.title} [${subTask.done ? "done" : "todo"}]`)
    .join("; ");
}

function formatResources(resources: RoadmapResource[]) {
  if (resources.length === 0) return "none";
  return resources
    .map((resource) => `${resource.title} (${resource.url})`)
    .join("; ");
}

function formatHours(value: number | null) {
  return value == null ? "unset" : String(value);
}

function formatInlineList(items: string[]) {
  const unique = Array.from(new Set(items));
  return unique.length > 0 ? unique.slice(0, 6).join(", ") : "none";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function getDirectionInstruction(direction: SuggestDirection, title: string) {
  if (direction === "above") {
    return `Suggest a missing prerequisite that should happen before "${title}" and would make it more executable.`;
  }

  if (direction === "below") {
    return `Suggest the most natural follow-up milestone that should happen after "${title}" and is directly unlocked by it.`;
  }

  return `Suggest a same-phase parallel workstream related to "${title}" without making it a prerequisite or dependent of that node.`;
}
