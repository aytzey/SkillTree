import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorldHeader } from "@/components/editor/world-header";
import type { ShareMode } from "@/types";

jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

const defaultProps = {
  title: "Test Tree",
  onSave: jest.fn().mockResolvedValue(undefined),
  onAddNode: jest.fn(),
  onChangeShareMode: jest.fn().mockResolvedValue(undefined),
  onExportPortable: jest.fn(),
  onExportBackup: jest.fn(),
  onImportNew: jest.fn(),
  onImportReplace: jest.fn(),
  onToggleMode: jest.fn(),
  shareMode: "private" as ShareMode,
  canEdit: true,
  canManageShare: true,
  isReadOnly: false,
  saveState: "idle" as const,
  shareFeedback: null,
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  return render(<WorldHeader {...defaultProps} {...overrides} />);
}

describe("world header", () => {
  it("keeps save and add node visible", () => {
    setup();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ node/i })).toBeInTheDocument();
  });

  it("hides secondary actions by default", () => {
    setup();
    expect(screen.queryByRole("button", { name: /export json/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /backup json/i })).toBeNull();
  });

  it("shows secondary actions after opening the overflow", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.getByRole("button", { name: /export json/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /backup json/i })).toBeInTheDocument();
  });

  it("closes the overflow after selecting an action", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /export json/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /export json/i })).toBeNull());
  });

  it("closes the overflow on outside click", async () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.mouseDown(container);
    await waitFor(() => expect(screen.queryByRole("button", { name: /export json/i })).toBeNull());
  });

  it("keeps share feedback visible without opening overflow", () => {
    setup({ shareFeedback: "Link copied!" });
    expect(screen.getByText("Link copied!")).toBeInTheDocument();
  });
});
