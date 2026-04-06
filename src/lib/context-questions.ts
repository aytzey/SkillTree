export interface ContextQuestionOption {
  value: string;
  label: string;
  desc?: string;
}

export interface ContextQuestion {
  id: string;
  label: string;
  summaryLabel: string;
  multi: boolean;
  options: ContextQuestionOption[];
}

type QuestionAnswers = Record<string, string[]>;
type QuestionCustomTexts = Record<string, string>;

export const DEFAULT_CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    id: "current_state",
    label: "What are you starting from?",
    summaryLabel: "Current state",
    multi: true,
    options: [
      { value: "scratch", label: "Starting from zero", desc: "No prior work on this yet" },
      { value: "research", label: "Research completed", desc: "You explored options or read docs" },
      { value: "prototype", label: "Prototype exists", desc: "A draft or proof of concept already exists" },
      { value: "existing", label: "Existing project", desc: "You are extending or fixing something real" },
    ],
  },
  {
    id: "primary_goal",
    label: "What do you need this roadmap to optimize for?",
    summaryLabel: "Primary goal",
    multi: false,
    options: [
      { value: "learn", label: "Learn deeply", desc: "Build understanding and confidence" },
      { value: "ship", label: "Ship fast", desc: "Reach a working result quickly" },
      { value: "improve", label: "Improve quality", desc: "Refactor, harden, or expand what exists" },
      { value: "coordinate", label: "Coordinate a team", desc: "Clarify work across multiple people" },
    ],
  },
  {
    id: "timeline",
    label: "What timeline should the roadmap assume?",
    summaryLabel: "Timeline",
    multi: false,
    options: [
      { value: "days", label: "A few days", desc: "Spike, trial, or weekend scope" },
      { value: "weeks", label: "A few weeks", desc: "Focused sprint or short build cycle" },
      { value: "months", label: "1-3 months", desc: "Substantial delivery scope" },
      { value: "ongoing", label: "Ongoing", desc: "No fixed deadline yet" },
    ],
  },
];

export function buildContextString(
  questions: ContextQuestion[],
  answers: QuestionAnswers,
  customTexts: QuestionCustomTexts,
  extraContext: string
) {
  const parts: string[] = [];

  for (const question of questions) {
    const selectedValues = answers[question.id] || [];
    const customText = customTexts[question.id]?.trim();
    if (selectedValues.length === 0 && !customText) continue;

    const selectedLabels = selectedValues.map((value) => (
      question.options.find((option) => option.value === value)?.label || value
    ));

    let line = `${question.summaryLabel}: ${selectedLabels.join(", ")}`;
    if (customText) {
      line += `${selectedLabels.length > 0 ? ". " : ""}Additional detail: ${customText}`;
    }
    parts.push(line);
  }

  if (extraContext.trim()) {
    parts.push(`Additional context: ${extraContext.trim()}`);
  }

  return parts.join("\n");
}

export function filterQuestionAnswers(
  answers: QuestionAnswers,
  questions: ContextQuestion[]
): QuestionAnswers {
  const allowedIds = new Set(questions.map((question) => question.id));
  const optionMap = new Map(
    questions.map((question) => [question.id, new Set(question.options.map((option) => option.value))])
  );

  return Object.fromEntries(
    Object.entries(answers)
      .filter(([questionId]) => allowedIds.has(questionId))
      .map(([questionId, values]) => ([
        questionId,
        values.filter((value) => optionMap.get(questionId)?.has(value)),
      ]))
      .filter(([, values]) => values.length > 0)
  );
}

export function filterQuestionCustomTexts(
  customTexts: QuestionCustomTexts,
  questions: ContextQuestion[]
): QuestionCustomTexts {
  const allowedIds = new Set(questions.map((question) => question.id));

  return Object.fromEntries(
    Object.entries(customTexts).filter(([questionId, value]) => (
      allowedIds.has(questionId) && value.trim().length > 0
    ))
  );
}

export function normalizeContextQuestions(input: unknown): ContextQuestion[] {
  if (!Array.isArray(input)) return DEFAULT_CONTEXT_QUESTIONS;

  const normalized: ContextQuestion[] = [];
  const usedIds = new Set<string>();

  for (const candidate of input) {
    const question = normalizeQuestion(candidate, usedIds);
    if (question) normalized.push(question);
    if (normalized.length >= 4) break;
  }

  return normalized.length >= 2 ? normalized : DEFAULT_CONTEXT_QUESTIONS;
}

function normalizeQuestion(candidate: unknown, usedIds: Set<string>) {
  if (!candidate || typeof candidate !== "object") return null;

  const record = candidate as Record<string, unknown>;
  const rawLabel = typeof record.label === "string" ? record.label.trim() : "";
  const rawSummaryLabel = typeof record.summaryLabel === "string" ? record.summaryLabel.trim() : "";
  const rawOptions = Array.isArray(record.options) ? record.options : [];
  const options = normalizeOptions(rawOptions);

  if (!rawLabel || options.length < 2) return null;

  const requestedId = typeof record.id === "string" ? record.id.trim() : "";
  const idBase = slugify(requestedId || rawSummaryLabel || rawLabel) || `question-${usedIds.size + 1}`;
  const id = ensureUniqueId(idBase, usedIds);
  const summaryLabel = rawSummaryLabel || stripQuestionSuffix(rawLabel);

  return {
    id,
    label: rawLabel,
    summaryLabel,
    multi: Boolean(record.multi),
    options,
  } satisfies ContextQuestion;
}

function normalizeOptions(input: unknown[]) {
  const options: ContextQuestionOption[] = [];
  const usedValues = new Set<string>();

  for (const candidate of input) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const rawLabel = typeof record.label === "string" ? record.label.trim() : "";
    const rawValue = typeof record.value === "string" ? record.value.trim() : "";
    if (!rawLabel) continue;

    const valueBase = slugify(rawValue || rawLabel);
    if (!valueBase || usedValues.has(valueBase)) continue;

    usedValues.add(valueBase);
    options.push({
      value: valueBase,
      label: rawLabel,
      desc: typeof record.desc === "string" && record.desc.trim()
        ? record.desc.trim()
        : undefined,
    });

    if (options.length >= 4) break;
  }

  return options;
}

function stripQuestionSuffix(value: string) {
  return value.replace(/[?.!:\s]+$/g, "").trim();
}

function ensureUniqueId(base: string, usedIds: Set<string>) {
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  const id = `${base}-${suffix}`;
  usedIds.add(id);
  return id;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
