import { createHash } from "node:crypto";
import type { ShareMode } from "@/types";

export type { ShareMode } from "@/types";

interface ShareableTree {
  userId: string;
  isPublic: boolean;
  shareMode?: ShareMode | null;
  editTokenHash?: string | null;
}
export function hashEditToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getEffectiveShareMode(tree: ShareableTree): ShareMode {
  if (tree.shareMode === "public_edit") {
    return tree.editTokenHash ? "public_edit" : "public_readonly";
  }

  if (tree.shareMode === "public_readonly") {
    return "public_readonly";
  }

  if (tree.isPublic) {
    return "public_readonly";
  }

  return "private";
}

export function canViewTree(tree: ShareableTree, userId: string | null) {
  if (tree.userId === userId) return true;
  return getEffectiveShareMode(tree) !== "private";
}

export function canEditTree(
  tree: ShareableTree,
  userId: string | null,
  rawEditToken: string | null
) {
  if (tree.userId === userId) return true;
  if (getEffectiveShareMode(tree) !== "public_edit") return false;
  if (!rawEditToken || !tree.editTokenHash) return false;
  return hashEditToken(rawEditToken) === tree.editTokenHash;
}

export function buildShareUrls(
  origin: string,
  slug: string,
  mode: ShareMode,
  rawEditToken: string | null
) {
  const readUrl = mode === "private" ? null : `${origin}/s/${slug}`;
  const editUrl =
    mode === "public_edit" && rawEditToken
      ? `${origin}/s/${slug}/edit?token=${encodeURIComponent(rawEditToken)}`
      : null;

  return { readUrl, editUrl };
}
