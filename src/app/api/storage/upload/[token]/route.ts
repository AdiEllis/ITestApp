import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/crypto";
import { localPath } from "@/lib/storage/local";
import { json } from "@/lib/http";

export const runtime = "nodejs";

/** Local-driver upload target (stands in for an S3 presigned PUT). Token-authorised, size-capped. */
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (env.storageDriver !== "local") return json({ error: "not found" }, 404);
  const { token } = await params;
  const data = verifyToken<{ k: string; op: string; max: number }>(token, env.appSecret);
  if (!data || data.op !== "put") return json({ error: "קישור ההעלאה פג תוקף" }, 403);
  if (!req.body) return json({ error: "empty body" }, 400);

  const target = localPath(data.k);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.part`;
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > data.max) cb(new Error("too large"));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as import("stream/web").ReadableStream), limiter, fs.createWriteStream(tmp));
    await fsp.rename(tmp, target);
  } catch {
    await fsp.rm(tmp, { force: true });
    return json({ error: received > data.max ? "הקובץ גדול מהגודל שהוצהר" : "ההעלאה נכשלה" }, 400);
  }
  return new Response(null, { status: 200 });
}
