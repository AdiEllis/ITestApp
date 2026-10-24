import Link from "next/link";
import { RecordingAudio } from "@/components/media/recording-audio";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isInSeb } from "@/lib/seb";
import { ArrowRight, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnAttempt } from "@/lib/authz";
import { countedQuestions } from "@/lib/scoring";
import { finalizeIfExpired, snapshotOf } from "@/lib/attempts";
import { Card } from "@/components/ui/card";
import { ScrollTop } from "@/components/scroll-top";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { En } from "@/components/ui/en";
import { LinkButton } from "@/components/ui/button";
import { formatDateTime, formatDuration, formatScore } from "@/lib/format";

export const metadata = { title: "תוצאות" };

export default async function AttemptResult({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; timeout?: string }> }) {
  const user = await requireUser(["STUDENT"]);
  const { id } = await params;
  const found = await getOwnAttempt(user, id).catch(() => null);
  if (!found) notFound();
  const attempt = await finalizeIfExpired(found);
  const snapshot = snapshotOf(attempt);
  const choices = (attempt.choices ?? {}) as Record<string, string>;
  const published = attempt.gradingStatus === "PUBLISHED";
  const answers = await db.answer.findMany({ where: { attemptId: id }, include: { recording: { select: { id: true, mimeType: true } } } });
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const counted = countedQuestions(snapshot, choices);
  const sp = await searchParams;
  const justSubmitted = sp.submitted === "1";
  const timedOut = sp.timeout === "1";
  const inSeb = found.assignment.requireSeb && isInSeb((await headers()).get("user-agent"), found.assignment.sebKey);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/s" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <ArrowRight className="size-4" /> המבחנים שלי
      </Link>
      {(timedOut || justSubmitted) && <ScrollTop />}
      {timedOut && (
        <Alert tone="info" title="הזמן של המבחן נגמר, והוא הוגש אוטומטית">
          במבחן השעון ממשיך לרוץ גם כשיוצאים מהמבחן, כמו בבחינה אמיתית. כל מה שהוקלט עד אז נשמר ונשלח למורה.
        </Alert>
      )}
      {justSubmitted && (
        <Alert tone="ok" title="המבחן הוגש בהצלחה">
          כל ההקלטות נשמרו. תקבלו משוב לאחר שהמורה תבדוק.
        </Alert>
      )}
      {inSeb && attempt.status !== "IN_PROGRESS" && (
        <LinkButton href="/seb/quit" size="lg" className="w-full">
          סיום ויציאה מהמבחן
        </LinkButton>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" dir="auto">
            {snapshot.title}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            ניסיון {attempt.attemptNumber}
            {attempt.submittedAt ? ` · הוגש ${formatDateTime(attempt.submittedAt)}` : ""}
          </p>
        </div>
        {published ? (
          <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-xs text-ink-3">ציון</p>
            <p className="text-3xl font-semibold tabular">{formatScore(attempt.totalScore)}</p>
          </div>
        ) : attempt.status === "RETURNED" ? (
          <Badge tone="rec">הוחזר לתרגול נוסף</Badge>
        ) : attempt.status === "IN_PROGRESS" ? (
          <LinkButton href={`/s/attempts/${id}/run`}>המשך המבחן</LinkButton>
        ) : (
          <Badge tone="warn">
            <Clock className="size-3" /> ממתין לבדיקה
          </Badge>
        )}
      </div>

      {attempt.status === "RETURNED" && (
        <Alert tone="warn" title="המורה החזיר/ה את המבחן">
          {attempt.returnNote || "ניתן לבצע את המבחן שוב."}
          <div className="mt-2">
            <LinkButton href={`/s/assignments/${attempt.assignmentId}`} size="sm">
              ביצוע חוזר
            </LinkButton>
          </div>
        </Alert>
      )}

      {published && attempt.overallFeedback && (
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
            <MessageSquare className="size-4 text-brand" /> משוב כללי מהמורה
          </h2>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2" dir="auto">
            {attempt.overallFeedback}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {counted.map(({ sectionId, questionId, points }) => {
          const section = snapshot.sections.find((s) => s.id === sectionId)!;
          const q = section.questions.find((x) => x.id === questionId);
          const a = byQ.get(questionId);
          return (
            <Card key={`${sectionId}:${questionId}`} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <En as="p" className="text-xs font-medium text-brand">
                    {section.title}
                  </En>
                  <En as="p" className="mt-1 font-medium">
                    {q ? q.title || q.prompt : "לא נבחר נושא"}
                  </En>
                </div>
                {published && (
                  <span className="shrink-0 text-sm font-semibold tabular">
                    {formatScore(a?.score ?? 0)} / {points}
                  </span>
                )}
              </div>
              {a?.textAnswer && (
                <p className="whitespace-pre-wrap rounded-lg border border-line bg-subtle/50 px-3 py-2 text-[15px] leading-relaxed" dir="auto">
                  {a.textAnswer}
                </p>
              )}
              {a?.recording ? (
                <div className="space-y-1">
                  <RecordingAudio src={`/api/media/${a.recording.id}`} className="w-full" aria-label="ההקלטה שלך" />
                  <p className="flex items-center gap-1.5 text-xs text-ink-3">
                    <CheckCircle2 className="size-3.5 text-ok" /> הקלטה · {formatDuration(a.durationSec)}
                  </p>
                </div>
              ) : !a?.textAnswer ? (
                <p className="text-sm text-warn">לא נענתה</p>
              ) : null}
              {published && a?.feedback && (
                <div className="rounded-lg bg-brand-soft px-3 py-2 text-sm leading-relaxed text-ink" dir="auto">
                  {a.feedback}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
