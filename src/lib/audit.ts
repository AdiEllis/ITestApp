import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Records a sensitive action. Never throws — auditing must not break the user flow. */
export async function audit(
  actorId: string | null,
  action: string,
  entity?: { type: string; id: string },
  meta?: Prisma.InputJsonValue,
) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entityType: entity?.type, entityId: entity?.id, meta },
    });
  } catch (err) {
    console.error("audit log failed", action, err);
  }
}
