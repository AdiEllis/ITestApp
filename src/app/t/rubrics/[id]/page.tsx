import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { RubricEditor } from "./editor";
import type { RubricCriterion } from "@/lib/exam-types";

export default async function RubricPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const r = await db.rubric.findUnique({ where: { id } });
  if (!r || r.ownerId !== user.id) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/t/rubrics" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> מחוונים
          </Link>
        }
        title="עריכת מחוון"
        description="שינוי מחוון משפיע על בדיקות עתידיות בלבד. מבחנים שכבר הוגשו נבדקים לפי המחוון שהיה בתוקף בעת ההגשה."
      />
      <RubricEditor id={id} initial={{ name: r.name, description: r.description, criteria: r.criteria as unknown as RubricCriterion[] }} />
    </div>
  );
}
