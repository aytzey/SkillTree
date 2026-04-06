import {
  buildRoadmapEnhancementPrompts,
  buildRoadmapGenerationPrompts,
  buildRoadmapSubTreePrompts,
  buildRoadmapSuggestionPrompts,
  type RoadmapPromptEdge,
  type RoadmapPromptNode,
} from "@/lib/roadmap-ai-prompts";

const sampleNodes: RoadmapPromptNode[] = [
  {
    id: "node-discovery",
    title: "Discovery",
    description: "Clarify scope and constraints before implementation starts.",
    difficulty: 2,
    estimatedHours: 4,
    subTasks: [{ title: "List success criteria", done: true }],
    resources: [{ title: "Product discovery guide", url: "https://www.atlassian.com/agile/product-management/product-discovery" }],
  },
  {
    id: "node-api",
    title: "API Foundation",
    description: "Define the service contract and core endpoints.",
    difficulty: 3,
    estimatedHours: 8,
    subTasks: [
      { title: "Draft endpoint contract", done: true },
      { title: "Add auth middleware", done: false },
    ],
    resources: [{ title: "REST API tutorial", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Express_Nodejs/routes" }],
  },
  {
    id: "node-ui",
    title: "UI Flow",
    description: "Create the main user journey and screens.",
    difficulty: 3,
    estimatedHours: 10,
    subTasks: [{ title: "Sketch critical screens", done: false }],
    resources: [{ title: "Interaction design foundation", url: "https://www.interaction-design.org/literature/topics/interaction-design" }],
  },
  {
    id: "node-launch",
    title: "Launch Prep",
    description: "Validate readiness and prepare the rollout.",
    difficulty: 4,
    estimatedHours: 6,
    subTasks: [{ title: "Review release checklist", done: false }],
    resources: [{ title: "Release checklist", url: "https://learn.microsoft.com/en-us/devops/operate/release-checklists/release-checklist" }],
  },
];

const sampleEdges: RoadmapPromptEdge[] = [
  { sourceNodeId: "node-discovery", targetNodeId: "node-api", type: "prerequisite" },
  { sourceNodeId: "node-discovery", targetNodeId: "node-ui", type: "prerequisite" },
  { sourceNodeId: "node-api", targetNodeId: "node-launch", type: "prerequisite" },
];

describe("roadmap ai prompts", () => {
  it("keeps both level and context in the roadmap generation prompt", () => {
    const prompts = buildRoadmapGenerationPrompts({
      topic: "Ship an internal analytics dashboard",
      level: "Intermediate team",
      context: "Current state: Existing prototype\nTimeline: A few weeks",
    });

    expect(prompts.userPrompt).toContain('Roadmap topic: "Ship an internal analytics dashboard"');
    expect(prompts.userPrompt).toContain("- Preferred experience level: Intermediate team");
    expect(prompts.userPrompt).toContain("- Current state: Existing prototype");
    expect(prompts.userPrompt).toContain("- Timeline: A few weeks");
    expect(prompts.systemPrompt).toContain("parallel workstreams");
    expect(prompts.systemPrompt).toContain("Never invent placeholder links");
  });

  it("anchors subtree prompts to the selected node and existing roadmap titles", () => {
    const prompts = buildRoadmapSubTreePrompts({
      treeTopic: "Launch a marketplace MVP",
      anchorNode: {
        title: "Payments",
        description: "Integrate checkout, refunds, and reconciliation.",
        difficulty: 4,
      },
      existingNodes: [
        { title: "Discovery", description: "Clarify scope." },
        { title: "Payments", description: "Already exists." },
      ],
      maxDepth: 3,
    });

    expect(prompts.systemPrompt).toContain('FIRST-LAYER nodes must depend on exactly ["Payments"]');
    expect(prompts.userPrompt).toContain("- Title: Payments");
    expect(prompts.userPrompt).toContain("- Discovery: Clarify scope.");
  });

  it("includes graph neighborhood context in suggestion prompts", () => {
    const prompts = buildRoadmapSuggestionPrompts({
      roadmapTitle: "Marketplace MVP",
      targetNode: sampleNodes[1],
      nodes: sampleNodes,
      edges: sampleEdges,
      direction: "parallel",
    });

    expect(prompts.systemPrompt).toContain("same-phase complementary workstream");
    expect(prompts.userPrompt).toContain("Incoming links: Discovery [prerequisite]");
    expect(prompts.userPrompt).toContain("Outgoing links: Launch Prep [prerequisite]");
    expect(prompts.userPrompt).toContain("Same-phase peers: UI Flow");
  });

  it("protects graph meaning and completed work in enhancement prompts", () => {
    const prompts = buildRoadmapEnhancementPrompts({
      roadmapTitle: "Marketplace MVP",
      targetNodes: [sampleNodes[1]],
      nodes: sampleNodes,
      edges: sampleEdges,
    });

    expect(prompts.systemPrompt).toContain("Preserve completed work");
    expect(prompts.systemPrompt).toContain("Do not change titles, ids, positions, or dependency meaning.");
    expect(prompts.userPrompt).toContain("Current subtasks: Draft endpoint contract [done]; Add auth middleware [todo]");
    expect(prompts.userPrompt).toContain("Use the roadmap inventory and each node's relationship context");
  });
});
