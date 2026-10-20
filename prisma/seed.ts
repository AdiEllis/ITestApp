/** Idempotent production seed: the system (default) rubric. No demo data. */
import { PrismaClient, type Prisma } from "@prisma/client";
import { defaultCobeRubric } from "../src/lib/cobe";

const db = new PrismaClient();

async function main() {
  const existing = await db.rubric.findFirst({ where: { ownerId: null } });
  if (existing) {
    console.log("System rubric already exists:", existing.id);
    return;
  }
  const r = await db.rubric.create({
    data: {
      ownerId: null,
      name: "COBE – מחוון ברירת מחדל",
      description: "קריטריונים לפי המחוונים הציבוריים של ה־COBE. משקלים לעריכה — יש לאמת מול המחוון הרשמי העדכני.",
      criteria: defaultCobeRubric() as unknown as Prisma.InputJsonValue,
    },
  });
  console.log("Created system rubric:", r.id);
}

main().finally(() => db.$disconnect());
