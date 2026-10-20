import Link from "next/link";
import { Archive, ChevronLeft, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CreateClassForm } from "./create-class-form";

export const metadata = { title: "כיתות" };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const showArchived = (await searchParams).archived === "1";
  const classes = await db.classroom.findMany({
    where: { teacherId: user.id, archived: showArchived },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true, assignments: true } } },
  });
  return (
    <>
      <PageHeader title="כיתות ותלמידים" description="צרו כיתה, הוסיפו תלמידים או שתפו קוד הצטרפות." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[15px] font-semibold">{showArchived ? "כיתות בארכיון" : "כיתות פעילות"}</h2>
            <Link href={showArchived ? "/t/classes" : "/t/classes?archived=1"} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
              <Archive className="size-4" />
              {showArchived ? "כיתות פעילות" : "ארכיון"}
            </Link>
          </div>
          {classes.length === 0 ? (
            <EmptyState icon={Users} title={showArchived ? "אין כיתות בארכיון" : "עדיין אין כיתות"} body={showArchived ? undefined : "צרו את הכיתה הראשונה כדי להוסיף תלמידים ולהקצות משימות."} />
          ) : (
            <ul className="divide-y divide-line">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link href={`/t/classes/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft font-semibold text-brand-strong">{c.name.charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {c.name} {c.isDemo && <Badge tone="warn">הדגמה</Badge>}
                      </p>
                      <p className="text-sm text-ink-3">
                        {c.gradeLevel ? `${c.gradeLevel} · ` : ""}
                        {c._count.enrollments} תלמידים · {c._count.assignments} משימות
                      </p>
                    </div>
                    <span dir="ltr" className="hidden rounded-md border border-line bg-subtle px-2 py-1 font-mono text-xs tracking-widest text-ink-2 sm:block">
                      {c.joinCode}
                    </span>
                    <ChevronLeft className="size-4 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-4 text-[15px] font-semibold">כיתה חדשה</h2>
          <CreateClassForm />
        </Card>
      </div>
    </>
  );
}
