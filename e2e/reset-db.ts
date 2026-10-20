/** Empties the dedicated e2e database (never point E2E_DATABASE_URL at real data). */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
db.$executeRawUnsafe(
  `TRUNCATE "AuditLog","Answer","Attempt","AssignmentStudent","Assignment","ExamSourceFile","Question","ExamSection","Exam","MediaFile","Rubric","Enrollment","Classroom","Session","RateLimit","User","School" CASCADE`,
).finally(() => db.$disconnect());
