import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { JourneyStatusBar } from "@/components/editor/journey-status-bar";
import { ROADMAP_COPY } from "@/lib/copy-constants";

function makeNodes(counts: { completed?: number; in_progress?: number; available?: number; locked?: number }) {
  const nodes: { status: string; progress: number }[] = [];
  for (let i = 0; i < (counts.completed ?? 0); i++) nodes.push({ status: "completed", progress: 100 });
  for (let i = 0; i < (counts.in_progress ?? 0); i++) nodes.push({ status: "in_progress", progress: 50 });
  for (let i = 0; i < (counts.available ?? 0); i++) nodes.push({ status: "available", progress: 0 });
  for (let i = 0; i < (counts.locked ?? 0); i++) nodes.push({ status: "locked", progress: 0 });
  return nodes;
}

describe("editor panels", () => {
  it("shows readable roadmap status labels", () => {
    render(<JourneyStatusBar nodes={makeNodes({ completed: 1, in_progress: 1, available: 1, locked: 1 })} selectedNodeTitle={null} />);
    expect(screen.getByText(ROADMAP_COPY.statuses.completed)).toBeInTheDocument();
    expect(screen.getByText(ROADMAP_COPY.statuses.in_progress)).toBeInTheDocument();
    expect(screen.getByText(ROADMAP_COPY.statuses.available)).toBeInTheDocument();
    expect(screen.getByText(ROADMAP_COPY.statuses.locked)).toBeInTheDocument();
  });

  it("renders a visually prominent selected node context", () => {
    render(<JourneyStatusBar nodes={makeNodes({ completed: 1, available: 2 })} selectedNodeTitle="Learn TypeScript" />);
    expect(screen.getByText("Learn TypeScript").closest("[data-selected-node]")).not.toBeNull();
  });

  it("keeps editor empty-state copy values defined in shared constants", () => {
    expect(ROADMAP_COPY.microcopy.editorEmptyTitle).toBeTruthy();
    expect(ROADMAP_COPY.microcopy.editorEmptyBody).toBeTruthy();
    expect(ROADMAP_COPY.ctas.editorEmpty).toBeTruthy();
  });
});
