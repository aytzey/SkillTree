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
    });

    expect(ROADMAP_MICROCOPY).toEqual({
      landingSubtitle: "Turn a goal into a clear roadmap of project steps and requirements.",
      dashboardSubtitle: "Plan milestones, project steps, and requirements in one place.",
      dashboardEmptyBody: "Create a roadmap to map the steps required to reach your goal.",
      creationSubtitle: "Choose how you want to build your roadmap.",
      creationAiModeDescription: "Describe the goal and AI will draft the roadmap.",
      creationBlankModeDescription: "Start with an empty roadmap and add each step yourself.",
      editorEmptyTitle: "No roadmap step selected",
      editorEmptyBody: "Select a step on the canvas to review requirements, resources, and progress.",
    });

    expect(ROADMAP_PRIMARY_CTA_COPY).toEqual({
      landing: "Start Your Roadmap",
      dashboard: "Create Roadmap",
      dashboardEmpty: "Create Your First Roadmap",
      creationAi: "Generate Roadmap",
      creationBlank: "Create Blank Roadmap",
      editorEmpty: "Add Roadmap Step",
    });
  });

  it("keeps the exported copy aligned to roadmap vocabulary", () => {
    const allCopy = collectStrings(ROADMAP_COPY).join(" ");

    expect(allCopy).toContain("Roadmap");
    expect(allCopy).not.toMatch(/skill tree|skill trees|journey|forge|forging/i);
    expect(ROADMAP_COPY.statuses).toBe(ROADMAP_STATUS_LABELS);
    expect(ROADMAP_COPY.sections).toBe(ROADMAP_SECTION_LABELS);
    expect(ROADMAP_COPY.microcopy).toBe(ROADMAP_MICROCOPY);
    expect(ROADMAP_COPY.ctas).toBe(ROADMAP_PRIMARY_CTA_COPY);
  });
});
