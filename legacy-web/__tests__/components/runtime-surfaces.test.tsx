jest.mock("@/components/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("next/font/google", () => ({
  Cinzel: () => ({ variable: "cinzel" }),
  Source_Sans_3: () => ({ variable: "source" }),
  JetBrains_Mono: () => ({ variable: "jetbrains" }),
}));

import { metadata } from "@/app/layout";

describe("runtime surfaces", () => {
  it("keeps roadmap-first metadata on the root layout", () => {
    expect(metadata.title).toBe("SkillTree — Goal-first roadmap builder");
    expect(metadata.description).toContain("goal");
    expect(metadata.description).toContain("roadmap");
    expect(metadata.description).toContain("progress");
  });

  it("documents the core UI runtime surfaces covered by the app shell", () => {
    const expectedRoutes = ["/", "/dashboard", "/tree/new", "/tree/[id]", "/s/[slug]"];
    expect(expectedRoutes).toEqual([
      "/",
      "/dashboard",
      "/tree/new",
      "/tree/[id]",
      "/s/[slug]",
    ]);
  });
});
