import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScoreTrend } from "@/components/score-trend";
import { formatDate, formatScore } from "@/lib/format";
import { snapshotOf } from "@/lib/attempts";

export const metadata = { title: "היסטוריה וציונים" };

export default async function HistoryPage() {
  const user = await requireUser(["STUDENT"]);
  const attempts = await db.attempt.findMany({
    where: { studentId: user.id, status: { not: "IN_PROGRESS" } },
    orderBy: { submittedAt: "desc" },
    include: { assignment: { select: { classroom: { select: { name: true } } } } },
  });
  const graded = attempts.filter((a) => a.gradingStatus === "PUBLISHED" && a.totalScore !== null).reverse();
  const avg = graded.length ? graded.reduce((s, a) => s + a.totalScore!, 0) / graded.length : null;
  return (
    <>
      <PageHeader title="היסטוריה וציונים" description="כל התרגולים והמבחנים שהגשת, והציונים שהמורה פרסמה." />
      {attempts.length === 0 ? (
        <Card>
          <EmptyState icon={History} title="עדיין אין הגשות" body="אחרי שתגישו תרגול או מבחן, הוא יופיע כאן." />
        </Card>
      ) : (
        <div className="space-y-6">
          {graded.length >= 2 && (
            <Card className="p-5">
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-[15px] font-semibold">מגמת ציונים</h2>
                <p className="text-sm text-ink-3">
                  ממוצע <span className="font-semibold text-ink tabular">{formatScore(avg && Math.round(avg * 10) / 10)}</span>
                </p>
              </div>
              <ScoreTrend points={graded.map((a) => ({ label: snapshotOf(a).title, date: formatDate(a.submittedAt!), score: Math.round(a.totalScore!) }))} />
            </Card>
          )}
          <Card>
            <table className="w-full text-sm">
              <thead className="bg-subtle/70 text-xs text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">מבחן</th>
                  <th className="hidden px-3 py-2.5 text-start font-medium sm:table-cell">כיתה</th>
                  <th className="px-3 py-2.5 text-start font-medium">הוגש</th>
                  <th className="px-4 py-2.5 text-start font-medium">ציון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-subtle/40">
                    <td className="px-4 py-3">
                      <Link href={`/s/attempts/${a.id}`} className="font-medium hover:text-brand" dir="auto">
                        {snapshotOf(a).title}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3 text-ink-3 sm:table-cell">{a.assignment.classroom.name}</td>
                    <td className="px-3 py-3 text-ink-3">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</td>
                    <td className="px-4 py-3 font-semibold tabular">
                      {a.gradingStatus === "PUBLISHED" ? formatScore(a.totalScore) : a.status === "RETURNED" ? <Badge tone="rec">הוחזר</Badge> : <Badge tone="warn">ממתין</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
