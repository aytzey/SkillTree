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

  const systemPrompt = `You are an expert education designer. Create a skill tree for learning a topic.
Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    {
      "title": "Node title",
      "description": "What this skill covers",
      "difficulty": 1,
      "estimatedHours": 2,
      "subTasks": [{"title": "subtask name", "done": false}],
      "resources": [{"title": "resource name", "url": "https://..."}],
      "dependencies": ["Title of prerequisite node"]
    }
  ]
}

Rules:
- Create 8-15 nodes for a well-structured tree
- Root nodes (fundamentals) have empty dependencies array
- Use exact titles in dependencies to reference other nodes
- difficulty: 1=trivial, 2=easy, 3=medium, 4=hard, 5=expert
- Provide 2-4 sub-tasks per node
- Provide 1-3 real resources with valid URLs per node
- Order nodes from fundamentals to advanced`;

  const userPrompt = `Create a skill tree for: "${topic}"
The learner's current level: ${level}
Return only JSON, no markdown.`;

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
    const errorText = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content) as GeneratedTree;
}
