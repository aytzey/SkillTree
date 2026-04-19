import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NewTreePage from "@/app/tree/new/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
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

describe("new roadmap page", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders a visible step indicator", () => {
    render(<NewTreePage />);
    expect(screen.getByTestId("step-indicator")).toBeInTheDocument();
  });

  it("does not show AI context questions before the required inputs are present", () => {
    render(<NewTreePage />);
    expect(screen.queryByText("Tailored context questions")).not.toBeInTheDocument();
  });

  it("shows a loading state while context questions are being fetched", async () => {
    let resolveQuestions: ((value: { ok: boolean; json: () => Promise<{ questions: [] }> }) => void) | null = null;

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/context-questions")) {
        return new Promise((resolve) => {
          resolveQuestions = resolve;
        });
      }

      return {
        ok: true,
        json: async () => ({ id: "tree-1" }),
      };
    }) as typeof fetch;

    render(<NewTreePage />);

    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Learn Rust" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ai generate/i }));
    fireEvent.change(screen.getByLabelText("Describe Your Goal"), {
      target: { value: "Build production-ready Rust web services" },
    });

    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(await screen.findByRole("status")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolveQuestions?.({
        ok: true,
        json: async () => ({ questions: [] }),
      });
    });
  });

  it("keeps the AI create action disabled until the required inputs are present", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ questions: [] }),
    }) as typeof fetch;

    render(<NewTreePage />);

    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Learn Rust" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ai generate/i }));

    const actionButton = screen.getByRole("button", { name: /generate roadmap/i });
    expect(actionButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Describe Your Goal"), {
      target: { value: "Build production-ready Rust web services" },
    });

    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    await waitFor(() => expect(actionButton).not.toBeDisabled());
  });
});
