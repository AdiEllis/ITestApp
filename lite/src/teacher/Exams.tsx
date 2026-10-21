import { BookOpen, Plus } from "lucide-react";
import { useStore } from "../lib/use-store";
import { exams, submissions } from "../lib/store";
import { Card, PageHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { buttonClass } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { LEVEL_LABELS, MODE_LABELS } from "../lib/types";
import { formatDate } from "../lib/format";

export function ExamsPage() {
  const data = useStore(async () => ({ exams: await exams.list(), subs: await submissions.list() }));
  if (!data) return null;
  return (
    <>
      <PageHeader
        title="מבחנים"
        description="כל מבחן נשמר בדפדפן שלך. בעמוד המבחן יוצרים קישור לכל כיתה."
        actions={
          <a href="#/t/exams/new" className={buttonClass()}>
            <Plus className="size-4" /> מבחן חדש
          </a>
        }
      />
      <Card>
        {data.exams.length === 0 ? (
          <EmptyState icon={BookOpen} title="עדיין אין מבחנים" body="צרו מבחן מתבנית COBE או ממבחן ריק." action={<a href="#/t/exams/new" className={buttonClass()}>מבחן חדש</a>} />
        ) : (
          <ul className="divide-y divide-line">
            {data.exams.map((e) => {
              const n = data.subs.filter((s) => s.exam.id === e.id).length;
              const q = e.sections.reduce((a, s) => a + s.questions.length, 0);
              return (
                <li key={e.id}>
                  <a href={`#/t/exams/${e.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium" dir="auto">
                          {e.title}
                        </p>
                        <Badge tone={e.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[e.mode]}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {LEVEL_LABELS[e.level]} · {e.sections.length} חלקים · {q} שאלות · {n} הגשות · עודכן {formatDate(e.updatedAt)}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
