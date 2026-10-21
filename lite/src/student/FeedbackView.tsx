import { MessageSquare } from "lucide-react";
import { decodeFeedbackLink } from "../lib/codec";
import { formatDate, formatScore } from "../lib/format";
import { Card } from "../ui/card";
import { Alert } from "../ui/alert";
import { En } from "../ui/en";
import { Logo } from "../ui/logo";

export function FeedbackView({ data }: { data: string }) {
  const f = decodeFeedbackLink(data);
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-2xl px-4 py-4">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-16">
        {!f ? (
          <Alert tone="danger" title="הקישור אינו תקין" />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-3">משוב עבור {f.studentName}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight" dir="auto">
                  {f.examTitle}
                </h1>
                <p className="mt-1 text-sm text-ink-3">{formatDate(f.date)}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-center shadow-[var(--shadow-card)]">
                <p className="text-xs text-ink-3">ציון</p>
                <p className="text-3xl font-semibold tabular">{formatScore(f.total)}</p>
              </div>
            </div>
            {f.overall && (
              <Card className="p-5">
                <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
                  <MessageSquare className="size-4 text-brand" /> משוב כללי
                </h2>
                <p className="whitespace-pre-wrap leading-relaxed text-ink-2" dir="auto">
                  {f.overall}
                </p>
              </Card>
            )}
            {f.items.map((it, i) => (
              <Card key={i} className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <En as="p" className="text-xs font-medium text-brand">
                      {it.section}
                    </En>
                    <En as="p" className="mt-1 font-medium">
                      {it.title}
                    </En>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular" dir="ltr">
                    {formatScore(it.score ?? 0)} / {it.points}
                  </span>
                </div>
                {it.feedback && (
                  <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm leading-relaxed" dir="auto">
                    {it.feedback}
                  </p>
                )}
              </Card>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
