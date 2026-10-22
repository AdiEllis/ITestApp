import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getViewableExam } from "@/lib/authz";
import { loadExam } from "@/lib/exams";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { En } from "@/components/ui/en";
import { MediaPlayer } from "@/components/media/media-player";
import { hasRecordLimit, MODE_LABELS } from "@/lib/exam-types";
import { formatDate, formatDuration } from "@/lib/format";
import { db } from "@/lib/db";
import { LibraryActions } from "./actions";

export default async function LibraryEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const entry = await getViewableExam(user, id).catch(() => null);
  if (!entry || !entry.isLibraryEntry) notFound();
  const exam = (await loadExam(id))!;
  const owner = await db.user.findUnique({ where: { id: exam.ownerId }, select: { name: true, school: { select: { name: true } } } });
  return (
    <>
      <PageHeader
        back={
          <Link href="/t/library" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> מאגר משותף
          </Link>
        }
        title={<span dir="auto">{exam.title}</span>}
        description={`שותף על ידי ${owner?.name ?? ""}${owner?.school ? ` (${owner.school.name})` : ""} · ${exam.sharedAt ? formatDate(exam.sharedAt) : ""}`}
        actions={
          <>
            <LinkButton href={`/preview/${id}`} variant="secondary" size="sm">
              <Eye className="size-4" /> תצוגת תלמיד
            </LinkButton>
            <LibraryActions entryId={id} mine={exam.ownerId === user.id} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge tone={exam.mode === "SIMULATION" ? "brand" : "neutral"}>{MODE_LABELS[exam.mode]}</Badge>
        {exam.subject && <Badge>{exam.subject}</Badge>}
        {exam.topics.map((t) => (
          <Badge key={t}>
            <span dir="auto">{t}</span>
          </Badge>
        ))}
      </div>
      {exam.description && <p className="mb-6 max-w-2xl text-ink-2" dir="auto">{exam.description}</p>}
      <div className="space-y-4">
        {exam.sections.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <En as="h2" className="font-semibold">
                {s.title}
              </En>
              <span className="text-xs text-ink-3">{s.choiceMode === "CHOOSE_ONE" ? "בחירת נושא אחד" : `${s.questions.length} שאלות`}</span>
            </div>
            {s.instructions && <En as="p" className="mt-2 text-sm text-ink-2">{s.instructions}</En>}
            {s.media && (
              <div className="mt-3 max-w-md">
                <MediaPlayer id={s.media.id} mimeType={s.media.mimeType} />
              </div>
            )}
            <ol className="mt-4 space-y-3">
              {s.questions.map((q) => (
                <li key={q.id} className="rounded-lg border border-line p-3">
                  <En as="p" className="text-sm font-medium">
                    {q.title ? `${q.title}: ` : ""}
                    {q.prompt}
                  </En>
                  {q.subQuestions.length > 0 && (
                    <ul dir="auto" className="mt-1 list-disc ps-5 text-start text-sm text-ink-2">
                      {q.subQuestions.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-ink-3">
                    {q.points} נק׳{hasRecordLimit(q.maxRecordSec) ? ` · הקלטה עד ${formatDuration(q.maxRecordSec)}` : ""}
                    {q.prepTimeSec ? ` · הכנה ${q.prepTimeSec} שנ׳` : ""}
                    {q.audio ? " · שמע" : ""}
                    {q.video ? " · וידאו" : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </>
  );
}
