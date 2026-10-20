import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { SchoolForms } from "./school-forms";

export const metadata = { title: "ניהול מערכת" };

export default async function AdminHome() {
  await requireUser(["ADMIN"]);
  const [schools, counts, recordings] = await Promise.all([
    db.school.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { users: true, classrooms: true } } } }),
    db.user.groupBy({ by: ["role"], _count: true }),
    db.mediaFile.aggregate({ where: { kind: "RECORDING" }, _count: true, _sum: { sizeBytes: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.role, x._count]));
  return (
    <>
      <PageHeader title="ניהול מערכת" description="בתי ספר, מדיניות שמירת הקלטות ומשתמשים." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["בתי ספר", schools.length],
          ["מורים", c.TEACHER ?? 0],
          ["תלמידים", c.STUDENT ?? 0],
          ["הקלטות", `${recordings._count} · ${Math.round((recordings._sum.sizeBytes ?? 0) / 1024 / 1024)}MB`],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <p className="text-sm text-ink-2">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{v}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="בתי ספר" description={`ברירת מחדל לשמירת הקלטות: ${env.defaultRetentionDays || "ללא הגבלה"} ימים. הסקריפט npm run retention מוחק הקלטות ישנות.`} />
        <SchoolForms schools={schools.map((s) => ({ id: s.id, name: s.name, code: s.teacherInviteCode, retention: s.recordingRetentionDays, users: s._count.users, classes: s._count.classrooms, demo: s.isDemo }))} />
      </Card>
    </>
  );
}
