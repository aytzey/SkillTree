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
});
