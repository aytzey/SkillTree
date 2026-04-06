import type { NodeStatus } from "@/types";

export const ROADMAP_STATUS_LABELS = {
  locked: "Blocked",
  available: "Ready",
  in_progress: "In Progress",
  completed: "Done",
} as const satisfies Record<NodeStatus, string>;

export const ROADMAP_SECTION_LABELS = {
  landingTitle: "Project Roadmaps",
  dashboardTitle: "Your Roadmaps",
  dashboardEmptyTitle: "No roadmaps yet",
  creationTitle: "New Roadmap",
  creationTitleField: "Roadmap Title",
  creationTopicField: "Goal or Project",
  creationContextField: "Current Context",
  editorStepTitle: "Roadmap Step",
  editorRequirements: "Requirements",
  editorResources: "Resources",
  editorDependencies: "Dependencies",
  editorActions: "Actions",
} as const;

export const ROADMAP_MICROCOPY = {
  landingSubtitle: "Turn a goal into a clear roadmap of project steps and requirements.",
  dashboardSubtitle: "Plan milestones, project steps, and requirements in one place.",
  dashboardEmptyBody: "Create a roadmap to map the steps required to reach your goal.",
  creationSubtitle: "Choose how you want to build your roadmap.",
  creationAiModeDescription: "Describe the goal and AI will draft the roadmap.",
  creationBlankModeDescription: "Start with an empty roadmap and add each step yourself.",
  editorEmptyTitle: "No roadmap step selected",
  editorEmptyBody: "Select a step on the canvas to review requirements, resources, and progress.",
} as const;

export const ROADMAP_PRIMARY_CTA_COPY = {
  landing: "Start Your Roadmap",
  dashboard: "Create Roadmap",
  dashboardEmpty: "Create Your First Roadmap",
  creationAi: "Generate Roadmap",
  creationBlank: "Create Blank Roadmap",
  editorEmpty: "Add Roadmap Step",
} as const;

export const ROADMAP_COPY = {
  statuses: ROADMAP_STATUS_LABELS,
  sections: ROADMAP_SECTION_LABELS,
  microcopy: ROADMAP_MICROCOPY,
  ctas: ROADMAP_PRIMARY_CTA_COPY,
} as const;
