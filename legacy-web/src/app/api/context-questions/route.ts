import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  DEFAULT_CONTEXT_QUESTIONS,
  normalizeContextQuestions,
} from "@/lib/context-questions";
import { requestOpenRouterJson } from "@/lib/openrouter";
import { buildRoadmapContextQuestionsPrompts } from "@/lib/roadmap-ai-prompts";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, topic } = await req.json();
  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedTopic = typeof topic === "string" ? topic.trim() : "";

  if (!trimmedTitle || !trimmedTopic) {
    return NextResponse.json(
      { error: "title and topic required" },
      { status: 400 }
    );
  }

  const prompts = buildRoadmapContextQuestionsPrompts({
    title: trimmedTitle,
    topic: trimmedTopic,
  });

  try {
    const content = await requestOpenRouterJson({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      temperature: 0.55,
    });

    const parsed = JSON.parse(content) as { questions?: unknown };
    const questions = normalizeContextQuestions(parsed.questions);
    const source = questions === DEFAULT_CONTEXT_QUESTIONS ? "fallback" : "ai";

    return NextResponse.json({ questions, source });
  } catch {
    return NextResponse.json({
      questions: DEFAULT_CONTEXT_QUESTIONS,
      source: "fallback",
    });
  }
}
