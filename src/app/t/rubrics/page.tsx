import Link from "next/link";
import { ChevronLeft, Copy, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { createRubricAction } from "../_actions/rubrics";
import type { RubricCriterion } from "@/lib/exam-types";

export const metadata = { title: "מחוונים" };

export default async function RubricsPage() {
  const user = await requireUser(["TEACHER"]);
  const rubrics = await db.rubric.findMany({ where: { OR: [{ ownerId: null }, { ownerId: user.id }] }, orderBy: [{ ownerId: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], include: { _count: { select: { exams: true } } } });
  return (
    <>
      <PageHeader
        title="מחוונים"
        description="מחוון קובע את הקריטריונים והמשקלים לבדיקת כל שאלה. הציון לשאלה מחושב לפי המשקלים — אתם קובעים את הציון בכל קריטריון."
        actions={
          <form action={createRubricAction.bind(null, undefined)}>
            <Button type="submit">
              <Plus className="size-4" /> מחוון חדש
            </Button>
          </form>
        }
      />
      <Alert tone="warn" className="mb-4" title="מחוון ברירת המחדל">
        שמות הקריטריונים מבוססים על המחוונים הציבוריים של ה־COBE, אך המשקלים והניסוחים הם ברירת מחדל לעריכה בלבד. יש לוודא מול המחוון הרשמי העדכני של משרד החינוך, וליצור עותק מותאם במידת הצורך.
      </Alert>
      <Card className="divide-y divide-line">
        {rubrics.map((r) => {
          const criteria = r.criteria as unknown as RubricCriterion[];
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {r.name} {r.ownerId === null && <Badge>מערכת</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-ink-3" dir="auto" style={{ textAlign: "start" }}>
                  {criteria.map((c) => `${c.label} ${c.weight}%`).join(" · ")}
                </p>
                {r.ownerId !== null && <p className="text-xs text-ink-3">בשימוש ב־{r._count.exams} מבחנים</p>}
              </div>
              <form action={createRubricAction.bind(null, r.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  <Copy className="size-4" /> שכפול
                </Button>
              </form>
              {r.ownerId === user.id && (
                <Link href={`/t/rubrics/${r.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                  עריכה <ChevronLeft className="size-4" />
                </Link>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
