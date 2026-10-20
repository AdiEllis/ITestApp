/**
 * Data-retention job. Run daily (cron / scheduled job):  npm run retention
 * - Deletes student recordings older than the school's retention period
 *   (School.recordingRetentionDays, else DEFAULT_RECORDING_RETENTION_DAYS; 0 = keep forever).
 * - Deletes abandoned uploads (PENDING for more than 24h).
 * - Deletes expired sessions and rate-limit rows.
 * Pass --dry-run to only report.
 */
import { PrismaClient } from "@prisma/client";
import { storage } from "../src/lib/storage";

const db = new PrismaClient();
const dry = process.argv.includes("--dry-run");

async function main() {
  const fallback = Number(process.env.DEFAULT_RECORDING_RETENTION_DAYS ?? "400");
  const schools = await db.school.findMany();
  let removed = 0;
  for (const s of schools) {
    const days = s.recordingRetentionDays ?? fallback;
    if (!days) continue;
    const cutoff = new Date(Date.now() - days * 86400_000);
    const old = await db.mediaFile.findMany({ where: { kind: "RECORDING", createdAt: { lt: cutoff }, owner: { schoolId: s.id } } });
    for (const m of old) {
      if (!dry) {
        await storage().delete(m.storageKey).catch((e) => console.error("delete failed", m.id, e));
        await db.mediaFile.delete({ where: { id: m.id } });
      }
      removed++;
    }
  }
  const stale = await db.mediaFile.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86400_000) } } });
  if (!dry) {
    for (const m of stale) {
      await storage().delete(m.storageKey).catch(() => undefined);
      await db.mediaFile.delete({ where: { id: m.id } }).catch(() => undefined);
    }
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    await db.auditLog.create({ data: { action: "system.retention", meta: { recordings: removed, staleUploads: stale.length } } });
  }
  console.log(`${dry ? "[dry-run] " : ""}recordings removed: ${removed}, stale uploads removed: ${stale.length}`);
}

main().finally(() => db.$disconnect());
