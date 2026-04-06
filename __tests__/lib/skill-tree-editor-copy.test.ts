import * as fs from "fs";
import * as path from "path";

// Regression guard: verify roadmap-framing copy strings in skill-tree-editor.tsx.
// These string checks prevent "New Skill" / "node" wording from creeping back in
// after t2-t7 upstream alignment work.

const editorSource = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/editor/skill-tree-editor.tsx"),
  "utf-8"
);

describe("skill-tree-editor roadmap copy", () => {
  it('uses "New Step" as the default title when creating a node (not "New Skill")', () => {
    expect(editorSource).not.toContain('"New Skill"');
    expect(editorSource.match(/"New Step"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('uses "Click a step to connect" in the pick mode banner (not "node")', () => {
    expect(editorSource).toContain("Click a step to connect");
    expect(editorSource).not.toContain("Click a node to connect");
  });
});
