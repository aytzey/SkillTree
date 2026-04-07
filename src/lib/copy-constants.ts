import type { NodeStatus } from "@/types";

export const ROADMAP_STATUS_LABELS = {
  locked: "Blocked",
  available: "Ready",
  in_progress: "In Progress",
  completed: "Done",
} as const satisfies Record<NodeStatus, string>;

export const ROADMAP_SECTION_LABELS = {
  landingTitle: "Set a Goal. Build the Path.",
  dashboardTitle: "Your Roadmaps",
  dashboardEmptyTitle: "No roadmaps yet",
  creationTitle: "New Roadmap",
  creationTitleField: "Goal",
  creationTopicField: "Describe Your Goal",
  creationContextField: "Context",
  editorStepTitle: "Step",
  editorRequirements: "Requirements",
  editorResources: "Resources",
  editorDependencies: "Dependencies",
  editorActions: "Actions",
} as const;

export const ROADMAP_MICROCOPY = {
  landingSubtitle: "Turn any goal into a clear roadmap of steps and requirements.",
  dashboardSubtitle: "Your goals, broken down into clear steps and requirements.",
  dashboardEmptyBody: "Pick a goal and build your first step-by-step roadmap.",
  creationSubtitle: "Define your goal and we'll map the steps to get there.",
  creationAiModeDescription: "Describe your goal, AI builds the roadmap.",
  creationBlankModeDescription: "Start from scratch.",
  editorEmptyTitle: "No step selected",
  editorEmptyBody: "Click a step on the canvas to inspect it.",
} as const;

export const ROADMAP_PRIMARY_CTA_COPY = {
  landing: "Start Your Roadmap",
  dashboard: "New Roadmap",
  dashboardEmpty: "Create Your First Roadmap",
  creationAi: "Generate Roadmap",
  creationBlank: "Create Blank Roadmap",
  editorEmpty: "Create New Step",
} as const;

export const ROADMAP_COPY = {
  statuses: ROADMAP_STATUS_LABELS,
  sections: ROADMAP_SECTION_LABELS,
  microcopy: ROADMAP_MICROCOPY,
  ctas: ROADMAP_PRIMARY_CTA_COPY,
} as const;
