import {
  DEFAULT_CONTEXT_QUESTIONS,
  buildContextString,
  filterQuestionAnswers,
  filterQuestionCustomTexts,
  normalizeContextQuestions,
  type ContextQuestion,
} from "@/lib/context-questions";

const sampleQuestions: ContextQuestion[] = [
  {
    id: "focus_area",
    label: "Which area matters most first?",
    summaryLabel: "Focus area",
    multi: false,
    options: [
      { value: "backend", label: "Backend APIs" },
      { value: "frontend", label: "Frontend UX" },
      { value: "ops", label: "Deployment and ops" },
    ],
  },
  {
    id: "constraints",
    label: "Which constraints should shape the plan?",
    summaryLabel: "Constraints",
    multi: true,
    options: [
      { value: "small_team", label: "Small team" },
      { value: "tight_deadline", label: "Tight deadline" },
      { value: "legacy_system", label: "Legacy system" },
    ],
  },
];

describe("context question utils", () => {
  it("builds a generic context summary from dynamic questions", () => {
    const result = buildContextString(
      sampleQuestions,
      {
        focus_area: ["backend"],
        constraints: ["small_team", "legacy_system"],
      },
      {
        constraints: "Existing infra must stay online during migration.",
      },
      "Need a phased rollout."
    );

    expect(result).toContain("Focus area: Backend APIs");
    expect(result).toContain("Constraints: Small team, Legacy system. Additional detail: Existing infra must stay online during migration.");
    expect(result).toContain("Additional context: Need a phased rollout.");
  });

  it("filters stale answers and custom texts against the current question set", () => {
    expect(filterQuestionAnswers({
      focus_area: ["backend", "missing"],
      old_question: ["anything"],
    }, sampleQuestions)).toEqual({
      focus_area: ["backend"],
    });

    expect(filterQuestionCustomTexts({
      constraints: "Keep Azure.",
      old_question: "stale",
      focus_area: "   ",
    }, sampleQuestions)).toEqual({
      constraints: "Keep Azure.",
    });
  });

  it("normalizes valid AI output and deduplicates ids and option values", () => {
    const normalized = normalizeContextQuestions([
      {
        id: "Focus Area",
        label: "Which area matters most first?",
        summaryLabel: "Focus area",
        multi: false,
        options: [
          { value: "Backend APIs", label: "Backend APIs" },
          { value: "Backend APIs", label: "Duplicate" },
          { label: "Frontend UX" },
        ],
      },
      {
        id: "Focus Area",
        label: "What delivery style fits best?",
        summaryLabel: "Delivery style",
        multi: false,
        options: [
          { label: "Prototype first" },
          { label: "Production-ready" },
        ],
      },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].id).toBe("focus_area");
    expect(normalized[0].options.map((option) => option.value)).toEqual(["backend_apis", "frontend_ux"]);
    expect(normalized[1].id).toBe("focus_area-2");
  });

  it("falls back to default questions when AI output is unusable", () => {
    expect(normalizeContextQuestions([{ label: "Broken", options: [] }])).toEqual(DEFAULT_CONTEXT_QUESTIONS);
    expect(normalizeContextQuestions("invalid")).toEqual(DEFAULT_CONTEXT_QUESTIONS);
  });
});
