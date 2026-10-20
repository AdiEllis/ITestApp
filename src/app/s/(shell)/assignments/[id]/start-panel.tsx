"use client";
import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { startAttemptAction } from "@/app/s/_actions/attempts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { MicCheck } from "@/components/runner/mic-check";

export function StartPanel({ assignmentId, resume, requireMicCheck }: { assignmentId: string; resume?: boolean; requireMicCheck: boolean }) {
  const [passed, setPassed] = useState(false);
  const [skip, setSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = resume || passed || (!requireMicCheck && skip);

  const go = () =>
    start(async () => {
      setError(null);
      const r = await startAttemptAction(assignmentId);
      if (r?.error) setError(r.error);
    });

  return (
    <Card className="space-y-4 p-5">
      {!resume && (
        <>
          <h2 className="text-[15px] font-semibold">בדיקת מיקרופון {requireMicCheck ? "(חובה)" : ""}</h2>
          {!skip && <MicCheck compact onPassed={() => setPassed(true)} />}
          {!requireMicCheck && !passed && !skip && (
            <button type="button" onClick={() => setSkip(true)} className="text-sm text-ink-3 underline-offset-2 hover:underline">
              דילוג — כבר בדקתי את המיקרופון
            </button>
          )}
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="lg" className="w-full" disabled={!ready || pending} onClick={go}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {resume ? "המשך המבחן" : "התחלת המבחן"}
      </Button>
      {!ready && <p className="text-center text-xs text-ink-3">יש להשלים את בדיקת המיקרופון כדי להתחיל</p>}
    </Card>
  );
}
