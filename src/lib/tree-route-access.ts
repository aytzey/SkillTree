import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { resolveTreeAccess } from "@/lib/tree-access";
import { EDIT_TOKEN_HEADER } from "@/lib/tree-share-constants";

export async function getTreeRouteAccessById(req: NextRequest, treeId: string) {
  const [user, tree] = await Promise.all([
    getSessionUser(),
    prisma.skillTree.findUnique({ where: { id: treeId } }),
  ]);

  if (!tree) {
    return { user, tree: null, access: null };
  }

  const access = resolveTreeAccess(tree, {
    userId: user?.id ?? null,
    editToken: req.headers.get(EDIT_TOKEN_HEADER),
  });

  return { user, tree, access };
}

export async function getTreeRouteAccessBySlug(req: NextRequest, slug: string) {
  const [user, tree] = await Promise.all([
    getSessionUser(),
    prisma.skillTree.findUnique({ where: { slug } }),
  ]);

  if (!tree) {
    return { user, tree: null, access: null };
  }

  const access = resolveTreeAccess(tree, {
    userId: user?.id ?? null,
    editToken: req.headers.get(EDIT_TOKEN_HEADER) ?? req.nextUrl.searchParams.get("token"),
  });

  return { user, tree, access };
}

export function getEditTokenHeader(token: string | null) {
  return token ? { [EDIT_TOKEN_HEADER]: token } : {};
}
