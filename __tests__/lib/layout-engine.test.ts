import { autoLayout } from "@/lib/layout-engine";

describe("autoLayout", () => {
  it("positions a single node at center", () => {
    const result = autoLayout([{ id: "a", width: 150, height: 80 }], []);
    expect(result.get("a")).toBeDefined();
    expect(typeof result.get("a")!.x).toBe("number");
    expect(typeof result.get("a")!.y).toBe("number");
  });

  it("positions connected nodes vertically (top-down)", () => {
    const result = autoLayout(
      [{ id: "a", width: 150, height: 80 }, { id: "b", width: 150, height: 80 }],
      [{ source: "a", target: "b" }]
    );
    expect(result.get("a")!.y).toBeLessThan(result.get("b")!.y);
  });

  it("positions siblings side by side", () => {
    const result = autoLayout(
      [{ id: "a", width: 150, height: 80 }, { id: "b", width: 150, height: 80 }, { id: "c", width: 150, height: 80 }],
      [{ source: "a", target: "b" }, { source: "a", target: "c" }]
    );
    expect(result.get("b")!.y).toBe(result.get("c")!.y);
    expect(result.get("b")!.x).not.toBe(result.get("c")!.x);
  });

  it("uses increased nodesep so siblings have at least 120px horizontal gap (center-to-center minus node width)", () => {
    // With nodesep >= 120, two siblings of width 150 will have centers >= 150+120 = 270px apart
    const result = autoLayout(
      [
        { id: "root", width: 150, height: 80 },
        { id: "left", width: 150, height: 80 },
        { id: "right", width: 150, height: 80 },
      ],
      [
        { source: "root", target: "left" },
        { source: "root", target: "right" },
      ]
    );
    const leftX = result.get("left")!.x;
    const rightX = result.get("right")!.x;
    const gap = Math.abs(rightX - leftX);
    // center-to-center gap must be >= nodeWidth + nodesep (150 + 120 = 270)
    expect(gap).toBeGreaterThanOrEqual(270);
  });

  it("uses increased ranksep so parent-child rows have at least 150px vertical gap (center-to-center minus node height)", () => {
    // With ranksep >= 150, parent center y and child center y >= nodeHeight + ranksep (80 + 150 = 230) apart
    const result = autoLayout(
      [
        { id: "a", width: 150, height: 80 },
        { id: "b", width: 150, height: 80 },
      ],
      [{ source: "a", target: "b" }]
    );
    const verticalGap = result.get("b")!.y - result.get("a")!.y;
    // center-to-center must be >= nodeHeight + ranksep (80 + 150 = 230)
    expect(verticalGap).toBeGreaterThanOrEqual(230);
  });
});
