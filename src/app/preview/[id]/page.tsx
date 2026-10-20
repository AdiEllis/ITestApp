import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getViewableExam } from "@/lib/authz";
import { buildSnapshot, loadExam } from "@/lib/exams";
import { ExamRunner } from "@/components/runner/exam-runner";

export const metadata = { title: "תצוגה מקדימה" };

/** Teacher preview: the real student runner, with recordings kept in the browser only. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const exam = await getViewableExam(user, id).catch(() => null);
  if (!exam) notFound();
  const full = await loadExam(id);
  const snapshot = buildSnapshot(full!);
  const limit = snapshot.settings.totalTimeLimitSec;
  return (
    <ExamRunner
        preview
        attemptId={`preview-${id}`}
        snapshot={snapshot}
        initialAnswers={{}}
        initialChoices={{}}
        initialProgress={{}}
        deadlineAt={limit ? new Date(Date.now() + limit * 1000).toISOString() : null}
        serverNow={new Date().toISOString()}
        exitHref={exam.isLibraryEntry ? `/t/library/${id}` : `/t/exams/${id}`}
      />
  );
}
