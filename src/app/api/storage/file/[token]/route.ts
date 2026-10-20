import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/crypto";
import { localPath, localReadStream } from "@/lib/storage/local";

export const runtime = "nodejs";

/** Local-driver download (stands in for an S3 presigned GET). Supports Range for audio/video seeking (required by Safari). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (env.storageDriver !== "local") return new Response("Not found", { status: 404 });
  const { token } = await params;
  const data = verifyToken<{ k: string; op: string; m: string; n: string | null }>(token, env.appSecret);
  if (!data || data.op !== "get") return new Response("Link expired", { status: 403 });

  let size: number;
  try {
    size = (await fsp.stat(localPath(data.k))).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": data.m,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    // PDFs are previewed in an iframe; Chrome refuses to render PDFs inside a CSP sandbox.
    ...(data.m === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; sandbox" }),
    "Content-Disposition": data.n ? `attachment; filename*=UTF-8''${encodeURIComponent(data.n)}` : "inline",
  };
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(localReadStream(data.k, start, end)) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(localReadStream(data.k)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
