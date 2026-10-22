import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { examHasAttempts, getOwnExam } from "@/lib/authz";
import { loadExam } from "@/lib/exams";
import { toBuilderState } from "@/lib/builder-state";
import { ExamBuilder } from "./builder";
import { ttsProvider } from "@/lib/tts";

export const metadata = { title: "עריכת מבחן" };
// Server actions on this page include the automatic voice, which can take several seconds.
export const maxDuration = 60;

export default async function ExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const user = await requireUser(["TEACHER"]);
  const { id } = await params;
  const own = await getOwnExam(user, id).catch(() => null);
  if (!own) notFound();
  const [exam, locked, rubrics, sources, shared] = await Promise.all([
    loadExam(id),
    examHasAttempts(id),
    db.rubric.findMany({ where: { OR: [{ ownerId: null }, { ownerId: user.id }] }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, ownerId: true } }),
    db.examSourceFile.findMany({ where: { examId: id }, include: { media: true }, orderBy: { createdAt: "asc" } }),
    db.exam.findFirst({ where: { libraryOfExamId: id, isLibraryEntry: true, status: "PUBLISHED" }, select: { id: true, sharedAt: true } }),
  ]);
  const state = toBuilderState(exam!);
  return (
    <ExamBuilder
      examId={id}
      initial={state.exam}
      initialMedia={state.media}
      status={exam!.status}
      locked={locked}
      rubrics={rubrics.map((r) => ({ id: r.id, name: r.name, system: r.ownerId === null }))}
      sourceFiles={sources.map((s) => ({ id: s.media.id, name: s.media.originalName, mimeType: s.media.mimeType, sizeBytes: s.media.sizeBytes }))}
      sharedEntry={shared ? { id: shared.id, sharedAt: shared.sharedAt!.toISOString() } : null}
      justCopied={(await searchParams).copied === "1"}
      ttsEnabled={!!ttsProvider()}
    />
  );
}
