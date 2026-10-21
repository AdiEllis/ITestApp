/** Run daily: npm run retention  (or --dry-run). On Vercel the same job runs via /api/cron/retention. */
import { PrismaClient } from "@prisma/client";
import { runRetention } from "../src/lib/retention";

const db = new PrismaClient();
const dry = process.argv.includes("--dry-run");
runRetention(db, dry)
  .then((r) => console.log(`${dry ? "[dry-run] " : ""}recordings removed: ${r.recordings}, stale uploads removed: ${r.staleUploads}`))
  .finally(() => db.$disconnect());
