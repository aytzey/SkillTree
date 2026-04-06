import {
  buildShareUrls,
  canEditTree,
  canViewTree,
  getEffectiveShareMode,
  hashEditToken,
  type ShareMode,
} from "@/lib/tree-sharing";

function makeTree(overrides: Partial<{
  userId: string;
  isPublic: boolean;
  shareMode: ShareMode | null;
  editTokenHash: string | null;
}> = {}) {
  return {
    userId: "owner-1",
    isPublic: false,
    shareMode: "private" as ShareMode,
    editTokenHash: null,
    ...overrides,
  };
}

describe("tree sharing helpers", () => {
  it("treats legacy public trees as public_readonly", () => {
    const tree = makeTree({ isPublic: true, shareMode: "private" });
    expect(getEffectiveShareMode(tree)).toBe("public_readonly");
  });

  it("allows the owner to edit regardless of share mode", () => {
    const tree = makeTree({ shareMode: "public_readonly" });
    expect(canEditTree(tree, "owner-1", null)).toBe(true);
  });

  it("requires a matching token for public editable links", () => {
    const token = "secret-edit-token";
    const tree = makeTree({
      isPublic: true,
      shareMode: "public_edit",
      editTokenHash: hashEditToken(token),
    });

    expect(canViewTree(tree, null)).toBe(true);
    expect(canEditTree(tree, null, "wrong-token")).toBe(false);
    expect(canEditTree(tree, null, token)).toBe(true);
  });

  it("builds mode-appropriate share urls", () => {
    expect(
      buildShareUrls("https://skiltree.test", "rust-path", "private", null)
    ).toEqual({ readUrl: null, editUrl: null });

    expect(
      buildShareUrls("https://skiltree.test", "rust-path", "public_readonly", null)
    ).toEqual({
      readUrl: "https://skiltree.test/s/rust-path",
      editUrl: null,
    });

    expect(
      buildShareUrls("https://skiltree.test", "rust-path", "public_edit", "token-123")
    ).toEqual({
      readUrl: "https://skiltree.test/s/rust-path",
      editUrl: "https://skiltree.test/s/rust-path/edit?token=token-123",
    });
  });
});
