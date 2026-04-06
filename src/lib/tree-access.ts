import type { SkillTreeData, ShareMode } from "@/types";
import { canEditTree, canViewTree, getEffectiveShareMode, hashEditToken } from "@/lib/tree-sharing";

export interface TreeAccessRecord {
  userId: string;
  isPublic: boolean;
  shareMode: ShareMode;
  editTokenHash: string | null;
}

export interface TreeAccessContext {
  userId: string | null;
  editToken: string | null;
}

export function resolveTreeAccess(tree: TreeAccessRecord, context: TreeAccessContext) {
  const shareMode = getEffectiveShareMode(tree);
  const canView = canViewTree(tree, context.userId);
  const canEdit = canEditTree(tree, context.userId, context.editToken);

  return {
    shareMode,
    canView,
    canEdit,
    isOwner: tree.userId === context.userId,
    isReadOnly: canView && !canEdit,
  };
}

export function normalizeShareMode(mode: unknown): ShareMode {
  if (mode === "public_readonly" || mode === "public_edit" || mode === "private") {
    return mode;
  }
  return "private";
}

export function coerceTreeDataShareMode(tree: Pick<SkillTreeData, "isPublic" | "shareMode">) {
  return tree.shareMode ?? (tree.isPublic ? "public_readonly" : "private");
}

export function prepareEditToken(rawToken: string | null) {
  return rawToken ? hashEditToken(rawToken) : null;
}
