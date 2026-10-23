import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canReadMedia } from "@/lib/authz";
import { getCurrentUser } from "@/lib/auth";
import { mediaCategory } from "@/lib/files";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Authorised media access: checks permissions, then redirects to a short-lived signed URL. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!(await canReadMedia(user, id))) return new Response("Not found", { status: 404 });
  const media = await db.mediaFile.findUniqueOrThrow({ where: { id } });
  const download = new URL(req.url).searchParams.get("download") === "1" || mediaCategory(media.mimeType) === "doc";
  const url = await storage().createDownloadUrl(media.storageKey, {
    // Long enough for a teacher who pauses grading and comes back; the player also reloads a stale link.
    ttlSec: 3 * 60 * 60,
    mimeType: media.mimeType,
    downloadName: download ? media.originalName ?? `file` : undefined,
  });
  const res = NextResponse.redirect(new URL(url, req.url), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
