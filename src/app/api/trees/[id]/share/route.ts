import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildShareUrls, hashEditToken } from "@/lib/tree-sharing";
import { normalizeShareMode } from "@/lib/tree-access";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await prisma.skillTree.findUnique({ where: { id } });
  if (!tree || tree.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const shareMode = normalizeShareMode(body.shareMode);
  const rawEditToken = shareMode === "public_edit" ? randomBytes(18).toString("hex") : null;

  const updated = await prisma.skillTree.update({
    where: { id },
    data: {
      isPublic: shareMode !== "private",
      shareMode,
      editTokenHash: rawEditToken ? hashEditToken(rawEditToken) : null,
    },
  });

  const origin = req.nextUrl.origin;
  const urls = buildShareUrls(origin, updated.slug, shareMode, rawEditToken);

  return NextResponse.json({
    isPublic: updated.isPublic,
    shareMode,
    ...urls,
  });
}
