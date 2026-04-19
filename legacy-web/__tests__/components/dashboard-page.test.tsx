import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardPage from "@/app/dashboard/page";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("next/link", () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("dashboard page", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("shows card-shaped skeletons while loading", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as typeof fetch;

    const { container } = render(<DashboardPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a continue banner and filters roadmap cards", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => [
        {
          id: "tree-1",
          title: "Rust Backend",
          description: "API roadmap",
          nodeCount: 10,
          progress: 30,
          updatedAt: "2026-04-07T10:00:00.000Z",
          isPublic: false,
        },
        {
          id: "tree-2",
          title: "React Fundamentals",
          description: "Frontend roadmap",
          nodeCount: 8,
          progress: 100,
          updatedAt: "2026-04-06T10:00:00.000Z",
          isPublic: true,
        },
      ],
    }) as typeof fetch;

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByText("Rust Backend").length).toBeGreaterThan(0));

    expect(screen.getByText("Resume latest roadmap")).toHaveAttribute("href", "/tree/tree-1");

    fireEvent.change(screen.getByPlaceholderText("Search by title or description"), {
      target: { value: "react" },
    });

    expect(screen.queryByText("Rust Backend")).not.toBeInTheDocument();
    expect(screen.getByText("React Fundamentals")).toBeInTheDocument();
  });
});
