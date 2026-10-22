import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { AssignForm } from "./form";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "שליחת מבחן לכיתה" };

export default async function NewAssignmentPage({ searchParams }: { searchParams: Promise<{ examId?: string; classroomId?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const sp = await searchParams;
  const [exams, classes] = await Promise.all([
    db.exam.findMany({ where: { ownerId: user.id, isLibraryEntry: false, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, mode: true } }),
    db.classroom.findMany({
      where: { teacherId: user.id, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, enrollments: { select: { student: { select: { id: true, name: true } } }, orderBy: { student: { name: "asc" } } } },
    }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={
          <Link href="/t/assignments" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> מבחנים שנשלחו
          </Link>
        }
        title="שליחת מבחן לכיתה"
        actions={<HelpButton topic="newAssignment" />}
      />
      {exams.length === 0 || classes.length === 0 ? (
        <Alert tone="info" title={exams.length === 0 ? "אין מבחנים מפורסמים" : "אין כיתות פעילות"}>
          {exams.length === 0 ? "יש ליצור ולפרסם מבחן לפני השליחה לכיתה." : "יש ליצור כיתה לפני השליחה לכיתה."}
          <div className="mt-3">
            <LinkButton href={exams.length === 0 ? "/t/exams" : "/t/classes"} size="sm" variant="secondary">
              {exams.length === 0 ? "למבחנים שלי" : "לכיתות"}
            </LinkButton>
          </div>
        </Alert>
      ) : (
        <Card className="p-5">
          <AssignForm
            exams={exams}
            classes={classes.map((c) => ({ id: c.id, name: c.name, students: c.enrollments.map((e) => e.student) }))}
            defaultExamId={sp.examId}
            defaultClassroomId={sp.classroomId}
          />
        </Card>
      )}
    </div>
  );
}
