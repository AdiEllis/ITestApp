/** Idempotent production seed: the system (default) rubrics. No demo data. */
import { PrismaClient, type Prisma } from "@prisma/client";
import { SYSTEM_RUBRICS } from "../src/lib/default-rubrics";

const db = new PrismaClient();

async function main() {
  for (const r of SYSTEM_RUBRICS) {
    const existing = await db.rubric.findFirst({ where: { ownerId: null, name: r.name } });
    if (existing) {
      console.log("System rubric already exists:", r.name);
      continue;
    }
    const created = await db.rubric.create({
      data: { ownerId: null, name: r.name, description: r.description, criteria: r.criteria() as unknown as Prisma.InputJsonValue },
    });
    console.log("Created system rubric:", created.id, r.name);
  }
}

main().finally(() => db.$disconnect());
