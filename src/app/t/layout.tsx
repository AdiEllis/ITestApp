import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { TeacherShell } from "./shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["TEACHER"]);
  if (user.mustChangePassword) redirect("/change-password");
  const pending = await db.attempt.count({
    where: { status: "SUBMITTED", gradingStatus: { not: "PUBLISHED" }, assignment: { classroom: { teacherId: user.id } } },
  });
  return (
    <TeacherShell user={{ name: user.name }} pending={pending} demo={user.isDemo}>
      {children}
    </TeacherShell>
  );
}
