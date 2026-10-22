import Link from "next/link";
import { BookOpen, ChevronLeft, FileUp, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { MODE_LABELS } from "@/lib/exam-types";
import { formatDate } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { HelpButton } from "@/components/help/help-button";

export const metadata = { title: "המבחנים שלי" };

const TABS = [
  { v: "active", l: "פעילים" },
  { v: "draft", l: "טיוטות" },
  { v: "archived", l: "ארכיון" },
] as const;

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.v === sp.tab)?.v ?? "active";
  const q = sp.q?.trim().slice(0, 80);
  const exams = await db.exam.findMany({
    where: {
      ownerId: user.id,
      isLibraryEntry: false,
      status: tab === "archived" ? "ARCHIVED" : tab === "draft" ? "DRAFT" : { in: ["PUBLISHED", "DRAFT"] },
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sections: true, assignments: true } }, sections: { select: { _count: { select: { questions: true } } } } },
  });
  return (
    <>
      <PageHeader
        title="המבחנים שלי"
        description="מבחנים ותרגולים פרטיים שיצרת או העתקת. מבחן חדש הוא פרטי עד שתבחרו לשתף אותו."
        actions={
          <>
            <HelpButton topic="exams" />
            <LinkButton href="/t/exams/import" variant="secondary">
              <FileUp className="size-4" /> העלאת מבחן מוכן
            </LinkButton>
            <LinkButton href="/t/exams/new">
              <Plus className="size-4" /> מבחן חדש
            </LinkButton>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-[#ebebe6] p-1 text-sm">
          {TABS.map((t) => (
            <Link key={t.v} href={`/t/exams?tab=${t.v}`} className={cn("rounded-md px-3 py-1.5 font-medium", tab === t.v ? "bg-surface shadow-sm" : "text-ink-2 hover:text-ink")} aria-current={tab === t.v ? "page" : undefined}>
              {t.l}
            </Link>
          ))}
        </div>
        <form className="w-full sm:w-64">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder="חיפוש לפי שם…" className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm" aria-label="חיפוש מבחנים" />
        </form>
      </div>
      <Card>
        {exams.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={q ? "לא נמצאו מבחנים" : tab === "archived" ? "אין מבחנים בארכיון" : "עדיין אין מבחנים"}
            body={!q && tab !== "archived" ? "צרו מבחן חדש, או העתיקו מבחן מהמאגר המשותף." : undefined}
            action={
              !q && tab !== "archived" ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/t/exams/new">
                    <Plus className="size-4" /> מבחן חדש
                  </LinkButton>
                  <LinkButton href="/t/library" variant="secondary">
                    למאגר המשותף
                  </LinkButton>
                </div>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {exams.map((e) => {
              const questions = e.sections.reduce((a, s) => a + s._count.questions, 0);
              return (
                <li key={e.id}>
                  <Link href={`/t/exams/${e.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium" dir="auto">
                          {e.title}
                        </p>
                        <Badge tone={e.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[e.mode]}</Badge>
                        {e.status === "DRAFT" && <Badge tone="warn">טיוטה</Badge>}
                        {e.isDemo && <Badge tone="warn">הדגמה</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {e.subject ? `${e.subject} · ` : ""}{e._count.sections} חלקים · {questions} שאלות · {e._count.assignments} הקצאות · עודכן {formatDate(e.updatedAt)}
                      </p>
                    </div>
                    <ChevronLeft className="size-4 shrink-0 text-ink-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
