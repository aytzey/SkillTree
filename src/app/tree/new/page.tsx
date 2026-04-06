"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface ContextQuestion {
  id: string;
  label: string;
  multi: boolean;
  options: { value: string; label: string; desc?: string }[];
}

const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    id: "currentState",
    label: "What do you have right now?",
    multi: true,
    options: [
      { value: "scratch", label: "Starting from zero", desc: "No prior work on this" },
      { value: "research", label: "Some research done", desc: "Explored options, read docs" },
      { value: "prototype", label: "A prototype or draft", desc: "Something rough exists" },
      { value: "existing", label: "Existing project", desc: "Extending or improving what's already built" },
    ],
  },
  {
    id: "goal",
    label: "What's the end goal?",
    multi: false,
    options: [
      { value: "learn", label: "Learn & understand", desc: "Gain knowledge or a new skill" },
      { value: "build", label: "Build something new", desc: "Ship a product, tool, or system" },
      { value: "improve", label: "Improve what exists", desc: "Refactor, optimize, or extend" },
      { value: "plan", label: "Plan for a team", desc: "Coordinate work across people" },
    ],
  },
  {
    id: "timeline",
    label: "How much time do you have?",
    multi: false,
    options: [
      { value: "days", label: "A few days", desc: "Weekend project or spike" },
      { value: "weeks", label: "A few weeks", desc: "Focused sprint" },
      { value: "months", label: "1-3 months", desc: "Substantial effort" },
      { value: "ongoing", label: "No fixed deadline", desc: "Ongoing or exploratory" },
    ],
  },
];

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

function ContextQuestionCard({
  question,
  selected,
  customText,
  onToggle,
  onCustomChange,
}: {
  question: ContextQuestion;
  selected: string[];
  customText: string;
  onToggle: (value: string) => void;
  onCustomChange: (text: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div>
      <label className="block text-[10px] text-poe-text-dim mb-2 uppercase tracking-wider font-mono">
        {question.label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${
                active
                  ? "border-poe-gold-mid bg-poe-gold-mid/10 text-poe-text-primary"
                  : "border-poe-border-dim text-poe-text-dim hover:border-poe-border-mid hover:text-poe-text-secondary"
              }`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              {opt.desc && (
                <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="mt-2 text-[10px] text-poe-text-dim hover:text-poe-gold-mid transition-colors font-mono"
      >
        {showCustom ? "- Hide custom answer" : "+ Add custom answer"}
      </button>
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <input
              value={customText}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="Describe in your own words..."
              className="poe-input w-full px-3 py-2 text-xs mt-1.5"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function buildContextString(
  answers: Record<string, string[]>,
  customTexts: Record<string, string>,
  extraContext: string
): string {
  const parts: string[] = [];

  // Current state
  const state = answers.currentState || [];
  const stateCustom = customTexts.currentState?.trim();
  if (state.length > 0 || stateCustom) {
    const labels = state.map((v) => {
      const q = CONTEXT_QUESTIONS.find((q) => q.id === "currentState");
      return q?.options.find((o) => o.value === v)?.label || v;
    });
    let line = `Current state: ${labels.join(", ")}`;
    if (stateCustom) line += `. Additional detail: ${stateCustom}`;
    parts.push(line);
  }

  // Goal
  const goal = answers.goal || [];
  const goalCustom = customTexts.goal?.trim();
  if (goal.length > 0 || goalCustom) {
    const labels = goal.map((v) => {
      const q = CONTEXT_QUESTIONS.find((q) => q.id === "goal");
      return q?.options.find((o) => o.value === v)?.label || v;
    });
    let line = `End goal: ${labels.join(", ")}`;
    if (goalCustom) line += `. Detail: ${goalCustom}`;
    parts.push(line);
  }

  // Timeline
  const timeline = answers.timeline || [];
  const timelineCustom = customTexts.timeline?.trim();
  if (timeline.length > 0 || timelineCustom) {
    const labels = timeline.map((v) => {
      const q = CONTEXT_QUESTIONS.find((q) => q.id === "timeline");
      return q?.options.find((o) => o.value === v)?.label || v;
    });
    let line = `Timeline: ${labels.join(", ")}`;
    if (timelineCustom) line += `. Detail: ${timelineCustom}`;
    parts.push(line);
  }

  if (extraContext.trim()) {
    parts.push(`Additional context: ${extraContext.trim()}`);
  }

  return parts.join("\n");
}

export default function NewTreePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "blank" | null>(null);

  // Context answers
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [extraContext, setExtraContext] = useState("");

  function handleToggle(questionId: string, value: string, multi: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (multi) {
        return {
          ...prev,
          [questionId]: current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
        };
      }
      return {
        ...prev,
        [questionId]: current.includes(value) ? [] : [value],
      };
    });
  }

  function handleCustomChange(questionId: string, text: string) {
    setCustomTexts((prev) => ({ ...prev, [questionId]: text }));
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setLoading(true);

    const treeRes = await fetch("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const tree = await treeRes.json();

    if (mode === "ai" && topic.trim()) {
      const context = buildContextString(answers, customTexts, extraContext);
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: tree.id, topic, context }),
      });
      if (!genRes.ok) console.error("AI generation failed");
    }

    router.push(`/tree/${tree.id}`);
  }

  const hasAnyContext =
    Object.values(answers).some((a) => a.length > 0) ||
    Object.values(customTexts).some((t) => t.trim()) ||
    extraContext.trim();

  return (
    <div className="min-h-screen bg-poe-void">
      {/* Header */}
      <div className="poe-header">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-between px-6 max-w-6xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-3">
            <svg className="w-5 h-5 text-poe-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-cinzel text-lg font-bold text-poe-gold-bright tracking-wider">SKILLTREE</span>
          </Link>
        </div>
        <div className="poe-ornate-border" />
      </div>

      <div className="max-w-lg mx-auto px-6 py-16">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-cinzel text-3xl font-bold text-poe-text-primary mb-2 text-center"
        >
          New Roadmap
        </motion.h1>
        <p className="text-sm text-poe-text-dim text-center mb-10">Define your goal and we&apos;ll map the steps to get there</p>

        {/* Title input */}
        <div className="mb-8">
          <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
            Goal
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Learn Rust Programming"
            className="poe-input w-full px-4 py-3 text-sm"
          />
        </div>

        {/* Mode selection */}
        {!mode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            <button
              onClick={() => setMode("ai")}
              className="border border-poe-border-dim rounded-lg p-6 text-center transition hover:border-poe-energy-blue group"
              style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
            >
              <div className="w-12 h-12 rounded-full border border-poe-energy-blue/30 flex items-center justify-center mx-auto mb-3 group-hover:border-poe-energy-blue/60 transition">
                <svg className="w-5 h-5 text-poe-energy-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div className="font-cinzel text-sm font-semibold text-poe-text-primary mb-1">AI Generate</div>
              <div className="text-[10px] text-poe-text-dim">Describe your goal, AI builds the roadmap</div>
            </button>

            <button
              onClick={() => setMode("blank")}
              className="border border-poe-border-dim rounded-lg p-6 text-center transition hover:border-poe-gold-dim group"
              style={{ background: "linear-gradient(180deg, #141430 0%, #0e0e24 100%)" }}
            >
              <div className="w-12 h-12 rounded-full border border-poe-gold-dim/30 flex items-center justify-center mx-auto mb-3 group-hover:border-poe-gold-dim/60 transition">
                <svg className="w-5 h-5 text-poe-gold-mid" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="font-cinzel text-sm font-semibold text-poe-text-primary mb-1">Blank Canvas</div>
              <div className="text-[10px] text-poe-text-dim">Start from scratch</div>
            </button>
          </motion.div>
        )}

        {/* AI mode */}
        {mode === "ai" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Topic */}
            <div>
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">Describe Your Goal</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to achieve? e.g., Build production-ready Rust web services from scratch"
                rows={3}
                className="poe-input w-full px-4 py-3 text-sm resize-none"
              />
            </div>

            {/* Context divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-poe-border-mid to-transparent" />
              <span className="text-[9px] text-poe-text-dim font-mono uppercase tracking-widest">Context</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-poe-border-mid to-transparent" />
            </div>

            {/* Context questions */}
            {CONTEXT_QUESTIONS.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3, ease: EASE_OUT }}
              >
                <ContextQuestionCard
                  question={q}
                  selected={answers[q.id] || []}
                  customText={customTexts[q.id] || ""}
                  onToggle={(value) => handleToggle(q.id, value, q.multi)}
                  onCustomChange={(text) => handleCustomChange(q.id, text)}
                />
              </motion.div>
            ))}

            {/* Extra context */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.3, ease: EASE_OUT }}
            >
              <label className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
                Anything else the AI should know?
                <span className="text-poe-text-dim/50 ml-1 normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Tools you prefer, team constraints, specific requirements..."
                rows={2}
                className="poe-input w-full px-4 py-3 text-xs resize-none"
              />
            </motion.div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setMode(null)} className="poe-btn px-4 py-2 text-sm">
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !title.trim() || !topic.trim()}
                className="flex-1 poe-btn py-3 font-cinzel font-semibold tracking-wider disabled:opacity-50"
                style={{ borderColor: "#5b5ef0", color: "#818cf8" }}
              >
                {loading ? "Building roadmap..." : "Generate Roadmap"}
              </button>
            </div>

            {/* Context preview */}
            {hasAnyContext && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-poe-border-dim p-3 mt-2"
                style={{ background: "rgba(20, 20, 48, 0.5)" }}
              >
                <div className="text-[9px] text-poe-text-dim font-mono uppercase tracking-wider mb-1.5">
                  Context preview
                </div>
                <pre className="text-[10px] text-poe-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                  {buildContextString(answers, customTexts, extraContext) || "No context provided yet"}
                </pre>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Blank mode */}
        {mode === "blank" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 pt-2">
            <button onClick={() => setMode(null)} className="poe-btn px-4 py-2 text-sm">
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="flex-1 poe-btn-gold poe-btn py-3 font-cinzel font-semibold tracking-wider disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Blank Roadmap"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
