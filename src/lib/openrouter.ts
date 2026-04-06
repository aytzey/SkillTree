import {
  buildRoadmapGenerationPrompts,
  buildRoadmapSubTreePrompts,
  type RoadmapGenerationPromptInput,
  type RoadmapSubTreePromptInput,
} from "@/lib/roadmap-ai-prompts";

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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function requestOpenRouterJson(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.45,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${errorText}`);
  }

  const data = await res.json() as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("OpenRouter returned empty content");
  }

  return content;
}

export async function generateSkillTree(input: RoadmapGenerationPromptInput): Promise<GeneratedTree> {
  const prompts = buildRoadmapGenerationPrompts(input);
  const content = await requestOpenRouterJson({
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    temperature: 0.45,
  });

  return JSON.parse(content) as GeneratedTree;
}

export async function generateSubTree(ctx: RoadmapSubTreePromptInput): Promise<GeneratedTree> {
  const prompts = buildRoadmapSubTreePrompts(ctx);
  const content = await requestOpenRouterJson({
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    temperature: 0.45,
  });

  return JSON.parse(content) as GeneratedTree;
}
