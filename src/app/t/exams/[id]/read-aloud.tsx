"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Square, Volume2, Wand2 } from "lucide-react";
import type { BuilderQuestion, MediaMeta } from "@/lib/builder-state";
import { audioMatchesText, spokenText } from "@/lib/exam-types";
import { hasDeviceVoice, speakWithDevice, stopDeviceVoice } from "@/lib/client/speech";
import { generateSpeechAction } from "../../_actions/exams";
import { MediaField } from "@/components/media/media-field";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

/**
 * The question's read-aloud audio. One audio file per question, made by the automatic voice or
 * recorded by the teacher. The teacher listens and approves it; students hear exactly this file.
 */
export function ReadAloudPanel({
  examId,
  q,
  media,
  sourceFiles,
  ttsEnabled,
  deviceVoiceFallback,
  onChange,
  onMedia,
}: {
  examId: string;
  q: BuilderQuestion;
  media: MediaMeta;
  sourceFiles: { id: string; name: string | null; mimeType: string; sizeBytes: number }[];
  ttsEnabled: boolean;
  deviceVoiceFallback: boolean;
  onChange: (p: Partial<BuilderQuestion>) => void;
  onMedia: (id: string | null, meta?: MediaMeta[string]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [showReadText, setShowReadText] = useState(!!q.readText);
  const text = spokenText(q);
  const current = audioMatchesText(q);
  const status = !q.audioId
    ? deviceVoiceFallback
      ? { tone: "neutral" as const, label: "קול המכשיר" }
      : { tone: "warn" as const, label: "אין עדיין הקראה" }
    : !current
      ? { tone: "danger" as const, label: "השאלה השתנתה, צריך הקראה חדשה" }
      : q.audioApproved
        ? { tone: "ok" as const, label: "ההקראה אושרה" }
        : { tone: "warn" as const, label: "צריך להאזין ולאשר" };

  async function toggleDeviceVoice() {
    if (speaking) {
      stopDeviceVoice();
      setSpeaking(false);
      return;
    }
    if (!(await hasDeviceVoice(text))) {
      setNoVoice(true);
      return;
    }
    setNoVoice(false);
    setSpeaking(true);
    speakWithDevice(text, () => setSpeaking(false));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    const r = await generateSpeechAction(examId, text);
    setBusy(false);
    if (!r.ok || !r.mediaId) {
      setError(r.ok ? "ההקראה לא נוצרה" : r.error);
      return;
    }
    onMedia(r.mediaId, r.meta);
    onChange({ audioId: r.mediaId, audioSource: "TTS", audioText: text, audioApproved: false });
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-soft/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Volume2 className="size-4 text-brand" /> הקראת השאלה לתלמיד/ה
        </p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {text && (
        <div className="space-y-1.5">
          <Button size="sm" variant="secondary" onClick={toggleDeviceVoice}>
            {speaking ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-4" />} {speaking ? "עצירה" : "השמעת השאלה בקול המחשב"}
          </Button>
          {noVoice ? (
            <p className="text-xs text-warn">במחשב הזה אין קול בעברית. כדי לשמוע, פתחו את האתר בדפדפן Microsoft Edge.</p>
          ) : (
            <p className="text-xs text-ink-3">
              לשמיעה מהירה בזמן הכתיבה. {deviceVoiceFallback && !q.audioId ? "בלי קובץ הקראה, כל תלמיד/ה ישמע/תשמע את הקול של המכשיר שלו/ה, והוא יכול להיות שונה." : "התלמידים ישמעו את קובץ ההקראה שלמטה."}
            </p>
          )}
        </div>
      )}

      {showReadText ? (
        <Field
          label="נוסח להקראה (לא חובה)"
          htmlFor={`rt-${q.key}`}
          hint="אם הקול טועה במילה, כתבו כאן את השאלה עם ניקוד, בכתיב מלא, או מספרים במילים. התלמיד/ה רואה את השאלה הרגילה ושומע/ת את הנוסח הזה."
        >
          <Textarea id={`rt-${q.key}`} dir="auto" rows={2} value={q.readText ?? ""} placeholder={text || "הנוסח של השאלה ייקרא כפי שהוא"} onChange={(e) => onChange({ readText: e.target.value || null })} />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowReadText(true)} className="text-sm text-brand hover:underline">
          הקול טועה במילה? אפשר לכתוב נוסח עם ניקוד להקראה
        </button>
      )}

      {q.audioId && !current && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> הטקסט של השאלה השתנה אחרי שההקראה נוצרה. צרו הקראה חדשה או הקליטו שוב.
        </p>
      )}

      {ttsEnabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={generate} disabled={busy || !text}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {q.audioId ? "יצירת הקראה אוטומטית מחדש" : "יצירת הקראה אוטומטית"}
          </Button>
          {!text && <span className="text-xs text-ink-3">כתבו קודם את השאלה</span>}
        </div>
      )}

      <MediaField
        label={q.audioId ? (q.audioSource === "TTS" ? "ההקראה שנוצרה" : "ההקלטה שלך") : ttsEnabled ? "או: הקלטה בקול שלך" : "הקלטה בקול שלך"}
        accept="audio"
        allowRecord
        value={q.audioId}
        media={media}
        sourceFiles={sourceFiles}
        onChange={(id, meta) => {
          onMedia(id, meta);
          onChange({ audioId: id, audioSource: id ? "TEACHER" : null, audioText: id ? text : null, audioApproved: false });
        }}
      />

      {q.audioId && current && (
        <div className="rounded-lg bg-surface p-3">
          <Checkbox
            checked={q.audioApproved}
            onChange={(e) => onChange({ audioApproved: e.target.checked })}
            label="האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון"
          />
          {q.audioApproved && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ok">
              <CheckCircle2 className="size-3.5" /> כל התלמידים ישמעו בדיוק את ההקראה הזאת
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
