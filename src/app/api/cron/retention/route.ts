import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { runRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily retention job. Vercel Cron calls it with "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runRetention(db);
  return Response.json(result);
}
