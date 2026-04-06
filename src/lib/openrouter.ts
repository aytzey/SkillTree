interface GeneratedNode {
  title: string;
  description: string;
  difficulty: number;
  estimatedHours: number;
  subTasks: { title: string; done: boolean }[];
  resources: { title: string; url: string }[];
  dependencies: string[];
}

interface GeneratedTree {
  nodes: GeneratedNode[];
}

export async function generateSkillTree(topic: string, level: string): Promise<GeneratedTree> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const systemPrompt = `You are an expert project planner. Create a project roadmap for a project centered on a topic.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    {
      "title": "Node title",
      "description": "Goal, requirement, or milestone covered by this roadmap item",
      "difficulty": 1,
      "estimatedHours": 2,
      "subTasks": [{"title": "execution step", "done": false}],
      "resources": [{"title": "resource name", "url": "https://..."}],
      "dependencies": ["Title of prerequisite node"]
    }
  ]
}

Rules:
- Create 8-15 nodes for a well-structured roadmap
- Each node should represent a project goal, requirement, milestone, or execution phase
- Root nodes (initial goals or setup requirements) have empty dependencies array
- Use exact titles in dependencies to reference prerequisite roadmap items
- difficulty: 1=trivial, 2=easy, 3=medium, 4=hard, 5=expert
- Provide 2-4 sub-tasks as concrete execution steps or next actions
- Provide 1-3 real resources with valid URLs per node
- Order nodes from goals and requirements through implementation milestones and final delivery`;

  const userPrompt = `Create a project roadmap for: "${topic}"
Current project context or maturity level: ${level}
Describe goals, requirements, dependencies, milestones, and next steps.
Return only JSON, no markdown.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content) as GeneratedTree;
}
