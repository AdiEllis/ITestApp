import { Download, Users } from "lucide-react";
import { useStore } from "../lib/use-store";
import { submissions } from "../lib/store";
import { download } from "../lib/codec";
import { formatDate, formatScore, normalizeName } from "../lib/format";
import { Card, CardHeader, PageHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { EmptyState } from "../ui/empty-state";
import { ScoreTrend } from "../ui/score-trend";
import type { Submission } from "../lib/types";

const keyOf = (s: Submission) => normalizeName(s.studentName).toLowerCase();

function csv(rows: (string | number)[][]) {
  // BOM so Excel opens Hebrew correctly.
  return "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export function Students({ selected }: { selected?: string }) {
  const subs = useStore(() => submissions.list());
  if (!subs) return null;
  const byStudent = new Map<string, Submission[]>();
  for (const s of subs) byStudent.set(keyOf(s), [...(byStudent.get(keyOf(s)) ?? []), s]);
  const students = [...byStudent.entries()]
    .map(([k, list]) => {
      const graded = list.filter((s) => s.grading?.status === "done");
      return { key: k, name: list[0].studentName, classes: [...new Set(list.map((s) => s.className).filter(Boolean))], count: list.length, avg: graded.length ? graded.reduce((a, s) => a + s.grading!.total, 0) / graded.length : null, last: Math.max(...list.map((s) => s.submittedAt)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const exportCsv = () => {
    const rows: (string | number)[][] = [["תלמיד/ה", "כיתה", "מבחן", "תאריך הגשה", "ציון", "סטטוס"]];
    for (const s of [...subs].sort((a, b) => a.studentName.localeCompare(b.studentName, "he") || a.submittedAt - b.submittedAt))
      rows.push([s.studentName, s.className, s.exam.title, formatDate(s.submittedAt), s.grading?.status === "done" ? s.grading.total : "", s.grading?.status === "done" ? "נבדק" : "ממתין"]);
    download(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }), `ציונים-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const sel = selected ? byStudent.get(selected) : undefined;
  if (sel) {
    const sorted = [...sel].sort((a, b) => a.submittedAt - b.submittedAt);
    const graded = sorted.filter((s) => s.grading?.status === "done");
    return (
      <>
        <PageHeader back={<a href="#/t/students" className="text-sm text-ink-2 hover:text-ink">→ כל התלמידים</a>} title={sel[0].studentName} description={`${sel.length} הגשות`} />
        {graded.length >= 2 && (
          <Card className="mb-6 p-5">
            <h2 className="mb-4 text-[15px] font-semibold">מגמת ציונים</h2>
            <ScoreTrend points={graded.map((s) => ({ label: s.exam.title, date: formatDate(s.submittedAt), score: Math.round(s.grading!.total) }))} />
          </Card>
        )}
        <Card>
          <ul className="divide-y divide-line">
            {[...sorted].reverse().map((s) => (
              <li key={s.id}>
                <a href={`#/t/review/${encodeURIComponent(s.id)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="auto">
                      {s.exam.title}
                    </p>
                    <p className="text-xs text-ink-3">
                      {s.className ? `${s.className} · ` : ""}
                      {formatDate(s.submittedAt)}
                    </p>
                  </div>
                  {s.grading?.status === "done" ? <span className="font-semibold tabular">{formatScore(s.grading.total)}</span> : <Badge tone="brand">לבדיקה</Badge>}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="תלמידים והתקדמות"
        description="נבנה אוטומטית מההגשות שייבאת. תלמידים מזוהים לפי השם שהזינו."
        actions={
          subs.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> ייצוא ציונים לאקסל
            </Button>
          )
        }
      />
      <Card>
        <CardHeader title={`${students.length} תלמידים`} />
        {students.length === 0 ? (
          <EmptyState icon={Users} title="עדיין אין תלמידים" body="אחרי שתייבאו הגשות, התלמידים וההתקדמות שלהם יופיעו כאן." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle/70 text-xs text-ink-3">
                <tr>
                  <th className="px-5 py-2.5 text-start font-medium">שם</th>
                  <th className="px-3 py-2.5 text-start font-medium">כיתה</th>
                  <th className="px-3 py-2.5 text-start font-medium">הגשות</th>
                  <th className="px-3 py-2.5 text-start font-medium">ממוצע</th>
                  <th className="px-5 py-2.5 text-start font-medium">הגשה אחרונה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s) => (
                  <tr key={s.key} className="hover:bg-subtle/40">
                    <td className="px-5 py-3 font-medium">
                      <a href={`#/t/students/${encodeURIComponent(s.key)}`} className="hover:text-brand">
                        {s.name}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-ink-3">{s.classes.join(", ") || "—"}</td>
                    <td className="px-3 py-3 tabular">{s.count}</td>
                    <td className="px-3 py-3 font-semibold tabular">{s.avg === null ? "—" : formatScore(Math.round(s.avg * 10) / 10)}</td>
                    <td className="px-5 py-3 text-ink-3">{formatDate(s.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
