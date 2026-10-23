import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentAssignmentWhere } from "@/lib/authz";
import { StudentShell } from "./shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  const now = new Date();
  // Open exams the student hasn't started yet.
  const fresh = await db.assignment.count({
    where: {
      ...studentAssignmentWhere(user.id),
      exam: { status: { not: "DRAFT" } },
      opensAt: { lte: now },
      OR: [{ dueAt: null }, { dueAt: { gte: now } }, { allowLate: true }],
      attempts: { none: { studentId: user.id } },
    },
  });
  return (
    <StudentShell name={user.name} demo={user.isDemo} fresh={fresh}>
      {children}
    </StudentShell>
  );
}
