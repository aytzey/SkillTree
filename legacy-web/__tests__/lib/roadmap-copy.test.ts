import {
  ROADMAP_COPY,
  ROADMAP_MICROCOPY,
  ROADMAP_PRIMARY_CTA_COPY,
  ROADMAP_SECTION_LABELS,
  ROADMAP_STATUS_LABELS,
} from "@/lib/copy-constants";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => collectStrings(item));
  return [];
}

describe("roadmap copy constants", () => {
  it("exports roadmap-oriented status labels", () => {
    expect(ROADMAP_STATUS_LABELS).toEqual({
      locked: "Blocked",
      available: "Ready",
      in_progress: "In Progress",
      completed: "Done",
    });
  });

  it("exports shared section labels, microcopy, and CTA copy for roadmap flows", () => {
    expect(ROADMAP_SECTION_LABELS).toEqual({
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
    });

    expect(ROADMAP_MICROCOPY).toEqual({
      landingSubtitle: "Turn any goal into a clear roadmap of steps and requirements.",
      dashboardSubtitle: "Your goals, broken down into clear steps and requirements.",
      dashboardEmptyBody: "Pick a goal and build your first step-by-step roadmap.",
      creationSubtitle: "Define your goal and we'll map the steps to get there.",
      creationAiModeDescription: "Describe your goal, AI builds the roadmap.",
      creationBlankModeDescription: "Start from scratch.",
      editorEmptyTitle: "No step selected",
      editorEmptyBody: "Click a step on the canvas to inspect it.",
    });

    expect(ROADMAP_PRIMARY_CTA_COPY).toEqual({
      landing: "Start Your Roadmap",
      dashboard: "New Roadmap",
      dashboardEmpty: "Create Your First Roadmap",
      creationAi: "Generate Roadmap",
      creationBlank: "Create Blank Roadmap",
      editorEmpty: "Create New Step",
    });
  });

  it("keeps the exported copy aligned to roadmap vocabulary", () => {
    const allCopy = collectStrings(ROADMAP_COPY).join(" ");
    const sharedCopyGroups = [ROADMAP_SECTION_LABELS, ROADMAP_MICROCOPY, ROADMAP_PRIMARY_CTA_COPY];

    expect(sharedCopyGroups.flatMap((group) => collectStrings(group)).every((value) => value.trim().length > 0)).toBe(true);
    expect(allCopy).toMatch(/roadmap/i);
    expect(allCopy).toMatch(/goal/i);
    expect(allCopy).toMatch(/step/i);
    expect(allCopy).not.toMatch(/skill tree|skill trees|journey|forge|forging/i);
    expect(ROADMAP_COPY.statuses).toBe(ROADMAP_STATUS_LABELS);
    expect(ROADMAP_COPY.sections).toBe(ROADMAP_SECTION_LABELS);
    expect(ROADMAP_COPY.microcopy).toBe(ROADMAP_MICROCOPY);
    expect(ROADMAP_COPY.ctas).toBe(ROADMAP_PRIMARY_CTA_COPY);
  });
});
