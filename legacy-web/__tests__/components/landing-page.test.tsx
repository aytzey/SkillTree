import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "@/app/page";
import { HeroTree } from "@/components/landing/hero-tree";
import { ROADMAP_PRIMARY_CTA_COPY } from "@/lib/copy-constants";

jest.mock("next/link", () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/components/landing/particles", () => ({
  Particles: () => null,
}));

describe("landing page", () => {
  it("uses the shared landing CTA in the nav", () => {
    render(<Home />);

    expect(screen.getByTestId("nav-primary-cta")).toHaveTextContent(ROADMAP_PRIMARY_CTA_COPY.landing);
  });

  it("renders a three-item benefit row before the CTA area", () => {
    render(<Home />);

    const benefitRow = screen.getByTestId("benefit-row");
    const ctaArea = screen.getByTestId("cta-area");

    expect(screen.getAllByTestId("benefit-item")).toHaveLength(3);
    expect(benefitRow.compareDocumentPosition(ctaArea)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe("hero tree", () => {
  it("renders staggered node delays", () => {
    render(<HeroTree />);

    const delays = screen.getAllByTestId("hero-node").map((node) => Number(node.getAttribute("data-delay")));
    expect(new Set(delays).size).toBeGreaterThan(1);
  });
});
