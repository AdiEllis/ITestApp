import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BarChart3, ListChecks, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnClassroom } from "@/lib/authz";
import { env } from "@/lib/env";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { archiveClassroomAction, regenerateJoinCodeAction, removeFromClassAction } from "../../_actions/classes";
import { AddStudents } from "./add-students";
import { ClassSettings } from "./class-settings";
import { CopyButton } from "@/components/copy-button";
import { formatDate } from "@/lib/format";
import { HelpButton } from "@/components/help/help-button";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const classroom = await getOwnClassroom(user, id).catch(() => null);
  if (!classroom) notFound();

  const [students, assignments] = await Promise.all([
    db.user.findMany({
      where: { enrollments: { some: { classroomId: id } } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        lastLoginAt: true,
        mustChangePassword: true,
        attempts: {
          where: { assignment: { classroomId: id } },
          select: { status: true, totalScore: true, gradingStatus: true, submittedAt: true },
        },
      },
    }),
    db.assignment.count({ where: { classroomId: id } }),
  ]);
  const joinUrl = `${env.appUrl}/join?code=${classroom.joinCode}`;

  return (
    <>
      <PageHeader
        back={
          <Link href="/t/classes" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> כל הכיתות
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {classroom.name} {classroom.archived && <Badge>בארכיון</Badge>}
          </span>
        }
        description={`${classroom.gradeLevel ? classroom.gradeLevel + " · " : ""}${students.length} תלמידים · ${assignments} משימות`}
        actions={
          <>
            <HelpButton topic="class" />
            <LinkButton href={`/t/assignments/new?classroomId=${id}`} variant="primary" size="sm">
              <ListChecks className="size-4" /> הקצאת מבחן
            </LinkButton>
            <LinkButton href={`/t/assignments?classroomId=${id}`} variant="secondary" size="sm">
              משימות הכיתה
            </LinkButton>
            <ConfirmAction
              action={archiveClassroomAction.bind(null, id, !classroom.archived)}
              trigger={classroom.archived ? "שחזור מהארכיון" : "העברה לארכיון"}
              triggerVariant="ghost"
              variant="primary"
              title={classroom.archived ? "לשחזר את הכיתה?" : "להעביר את הכיתה לארכיון?"}
              body={classroom.archived ? undefined : "תלמידים לא יראו משימות של כיתה בארכיון. הנתונים וההקלטות נשמרים."}
              confirmLabel="אישור"
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <div className={students.length === 0 ? "order-first" : "order-last"}>
            <AddStudents classroomId={id} className={classroom.name} google={env.googleEnabled} joinUrl={joinUrl} />
          </div>
          <Card>
            <CardHeader title="תלמידים" description="לחיצה על שם — התקדמות התלמיד/ה לאורך השנה" />
            {students.length === 0 ? (
              <EmptyState icon={Users} title="אין עדיין תלמידים בכיתה" body={env.googleEnabled ? "שלחו לתלמידים את קישור ההצטרפות (למטה). כל מי שמצטרף יופיע כאן." : "הוסיפו תלמידים לפי שם, או שתפו את קוד ההצטרפות."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/70 text-xs text-ink-3">
                    <tr>
                      <th className="px-5 py-2.5 text-start font-medium">שם</th>
                      <th className="px-3 py-2.5 text-start font-medium">שם משתמש</th>
                      <th className="px-3 py-2.5 text-start font-medium">הגשות</th>
                      <th className="px-3 py-2.5 text-start font-medium">ממוצע</th>
                      <th className="px-3 py-2.5 text-start font-medium">כניסה אחרונה</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {students.map((s) => {
                      const submitted = s.attempts.filter((a) => a.status !== "IN_PROGRESS").length;
                      const graded = s.attempts.filter((a) => a.gradingStatus === "PUBLISHED" && a.totalScore !== null);
                      const avg = graded.length ? Math.round(graded.reduce((x, a) => x + (a.totalScore ?? 0), 0) / graded.length) : null;
                      return (
                        <tr key={s.id} className="hover:bg-subtle/40">
                          <td className="px-5 py-3 font-medium">
                            <Link href={`/t/students/${s.id}`} className="hover:text-brand">
                              {s.name}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-mono text-[13px] text-ink-2" dir="ltr">
                            {s.username}
                          </td>
                          <td className="px-3 py-3 tabular">{submitted}</td>
                          <td className="px-3 py-3 tabular">{avg ?? "—"}</td>
                          <td className="px-3 py-3 text-ink-3">
                            {s.lastLoginAt ? formatDate(s.lastLoginAt) : s.mustChangePassword ? <Badge tone="warn">טרם התחבר/ה</Badge> : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              <LinkButton href={`/t/students/${s.id}`} variant="ghost" size="sm" aria-label={`התקדמות של ${s.name}`}>
                                <BarChart3 className="size-4" />
                              </LinkButton>
                              <ConfirmAction
                                action={removeFromClassAction.bind(null, id, s.id)}
                                trigger="הסרה"
                                triggerVariant="ghost"
                                title={`להסיר את ${s.name} מהכיתה?`}
                                body="החשבון וההגשות הקודמות נשמרים. למחיקה מלאה — דרך עמוד התלמיד/ה."
                                confirmLabel="הסרה"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">קוד הצטרפות</h2>
            <p className="mt-1 text-sm text-ink-3">{env.googleEnabled ? "אפשר גם להקליד את הקוד בדף \"הצטרפות לכיתה\" באתר." : "תלמידים נכנסים לכתובת ההצטרפות ובוחרים שם משתמש וסיסמה."}</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
              <span dir="ltr" className="font-mono text-2xl font-semibold tracking-[0.25em]">
                {classroom.joinCode}
              </span>
              <CopyButton value={joinUrl} label="העתקת קישור" />
            </div>
            <p className={`mt-2 text-xs ${classroom.joinEnabled ? "text-ok" : "text-warn"}`}>{classroom.joinEnabled ? "ההצטרפות פתוחה" : "ההצטרפות סגורה"}</p>
            <div className="mt-3">
              <ConfirmAction
                action={regenerateJoinCodeAction.bind(null, id)}
                trigger="יצירת קוד חדש"
                triggerVariant="secondary"
                variant="primary"
                title="ליצור קוד הצטרפות חדש?"
                body="הקוד הקודם יפסיק לעבוד. תלמידים שכבר הצטרפו לא יושפעו."
              />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-[15px] font-semibold">הגדרות כיתה</h2>
            <ClassSettings classroom={{ id, name: classroom.name, gradeLevel: classroom.gradeLevel, joinEnabled: classroom.joinEnabled }} />
          </Card>
          <p className="px-1 text-xs text-ink-3">נוצרה ב־{formatDate(classroom.createdAt)}</p>
        </div>
      </div>
    </>
  );
}
