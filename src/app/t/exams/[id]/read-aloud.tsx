"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookA, CheckCircle2, Loader2, Square, Trash2, Volume2, Wand2 } from "lucide-react";
import type { BuilderQuestion, MediaMeta } from "@/lib/builder-state";
import { audioMatchesText, spokenText } from "@/lib/exam-types";
import { hasDeviceVoice, speakWithDevice, stopDeviceVoice } from "@/lib/client/speech";
import { applyPronunciation, normalizeWritten } from "@/lib/pronunciation";
import { deletePronunciationAction, generateSpeechAction, savePronunciationAction, type PronunciationRow } from "../../_actions/exams";
import { MediaField } from "@/components/media/media-field";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

export type VoiceOption = { id: "gemini" | "azure" | "google" | "fake"; label: string };

const VOICE_KEY = "oralprep.voice";

/** The voices on offer and the teacher's pronunciation dictionary, shared by every question. */
const ReadAloudContext = createContext<{
  voices: VoiceOption[];
  voice: VoiceOption["id"] | undefined;
  setVoice: (v: VoiceOption["id"]) => void;
  fixes: PronunciationRow[];
  setFixes: (fn: (rows: PronunciationRow[]) => PronunciationRow[]) => void;
}>({ voices: [], voice: undefined, setVoice: () => {}, fixes: [], setFixes: () => {} });

export function ReadAloudProvider(props: { voices: VoiceOption[]; initialPronunciations: PronunciationRow[]; children: React.ReactNode }) {
  const [voice, setVoiceState] = useState(props.voices[0]?.id);
  const [fixes, setFixes] = useState(props.initialPronunciations);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOICE_KEY);
      if (saved && props.voices.some((v) => v.id === saved)) setVoiceState(saved as VoiceOption["id"]);
    } catch {}
  }, [props.voices]);
  const value = useMemo(
    () => ({
      voices: props.voices,
      voice,
      setVoice: (v: VoiceOption["id"]) => {
        setVoiceState(v);
        try {
          localStorage.setItem(VOICE_KEY, v);
        } catch {}
      },
      fixes,
      setFixes,
    }),
    [props.voices, voice, fixes],
  );
  return <ReadAloudContext.Provider value={value}>{props.children}</ReadAloudContext.Provider>;
}

/**
 * Words the voice says wrong, and how to make it say them right. Kept per teacher and applied to every
 * read-aloud she creates from now on.
 */
function PronunciationDictionary({ text, onAdded }: { text: string; onAdded: () => void }) {
  const { fixes, setFixes } = useContext(ReadAloudContext);
  const [open, setOpen] = useState(false);
  const [written, setWritten] = useState("");
  const [spoken, setSpoken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inThisQuestion = fixes.filter((f) => applyPronunciation(text, [f]) !== text);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await savePronunciationAction({ written, spoken });
      if (!r.ok || !r.row) {
        setError(r.ok ? "המילה לא נשמרה" : r.error);
        return;
      }
      const row = r.row;
      setFixes((rows) => [...rows.filter((x) => x.written !== row.written), row].sort((a, b) => a.written.localeCompare(b.written, "he")));
      setWritten("");
      setSpoken("");
      if (applyPronunciation(text, [row]) !== text) onAdded();
    } catch {
      setError("החיבור לשרת נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const r = await deletePronunciationAction(id).catch(() => null);
    if (r?.ok) setFixes((rows) => rows.filter((x) => x.id !== id));
    else setError("המחיקה נכשלה. נסו שוב.");
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-brand hover:underline">
        <BookA className="size-4" /> הקול הוגה מילה לא נכון? מילון הגייה{fixes.length ? ` (${fixes.length})` : ""}
      </button>
    );

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BookA className="size-4 text-brand" /> מילון הגייה
        </p>
        <p className="mt-1 text-xs text-ink-3">
          כתבו מילה שהקול הוגה לא נכון, ולידה איך להקריא אותה: עם ניקוד, בכתיב מלא, או כפי שהיא נשמעת. התיקון נשמר ויחול על כל ההקראות שתיצרו, בכל המבחנים. התלמידים רואים את המילה כרגיל.
        </p>
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <Field label="המילה כפי שהיא כתובה" htmlFor="pron-written" className="min-w-36 flex-1">
          <Input id="pron-written" dir="auto" value={written} onChange={(e) => setWritten(e.target.value)} placeholder="לדוגמה: ספר" />
        </Field>
        <Field label="איך להקריא אותה" htmlFor="pron-spoken" className="min-w-36 flex-1">
          <Input id="pron-spoken" dir="auto" value={spoken} onChange={(e) => setSpoken(e.target.value)} placeholder="לדוגמה: סֵפֶר" />
        </Field>
        <Button size="sm" type="submit" disabled={busy || !normalizeWritten(written) || !spoken.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" />} הוספה למילון
        </Button>
      </form>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {inThisQuestion.length > 0 && <p className="text-xs text-ok">בשאלה הזאת יתוקנו: {inThisQuestion.map((f) => f.written).join(", ")}</p>}
      {fixes.length > 0 && (
        <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line text-sm" aria-label="המילים במילון">
          {fixes.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="font-medium">{f.written}</span>
              <span className="text-ink-3">←</span>
              <span className="flex-1">{f.spoken}</span>
              <button type="button" onClick={() => remove(f.id)} className="text-ink-3 hover:text-danger" aria-label={`מחיקת ${f.written} מהמילון`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-3 hover:underline">
        סגירה
      </button>
    </div>
  );
}

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
  const [fixAdded, setFixAdded] = useState(false);
  const [fixedWords, setFixedWords] = useState<string[]>([]);
  const { voices, voice, setVoice } = useContext(ReadAloudContext);
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
    let r: Awaited<ReturnType<typeof generateSpeechAction>>;
    try {
      r = await generateSpeechAction(examId, text, voice);
    } catch {
      setError("ההקראה לא נוצרה: החיבור לשרת נכשל. נסו שוב, או הקליטו את השאלה בקול.");
      return;
    } finally {
      setBusy(false);
    }
    if (!r.ok || !r.mediaId) {
      setError(r.ok ? "ההקראה לא נוצרה" : r.error);
      return;
    }
    setFixAdded(false);
    setFixedWords(r.fixedWords ?? []);
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

      {ttsEnabled && <PronunciationDictionary text={text} onAdded={() => setFixAdded(true)} />}
      {fixAdded && q.audioId && q.audioSource === "TTS" && <p className="text-sm text-warn">התיקון נשמר. צרו הקראה מחדש כדי לשמוע אותו.</p>}

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
          אפשר גם לכתוב לשאלה הזאת נוסח שלם להקראה
        </button>
      )}

      {q.audioId && !current && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> הטקסט של השאלה השתנה אחרי שההקראה נוצרה. צרו הקראה חדשה או הקליטו שוב.
        </p>
      )}

      {ttsEnabled && (
        <div className="flex flex-wrap items-center gap-2">
          {voices.length > 1 && (
            <Select aria-label="הקול להקראה" value={voice} onChange={(e) => setVoice(e.target.value as VoiceOption["id"])} className="w-auto">
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          )}
          <Button size="sm" onClick={generate} disabled={busy || !text}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {q.audioId ? "יצירת הקראה אוטומטית מחדש" : "יצירת הקראה אוטומטית"}
          </Button>
          {!text && <span className="text-xs text-ink-3">כתבו קודם את השאלה</span>}
          {!busy && fixedWords.length > 0 && q.audioSource === "TTS" && <span className="text-xs text-ok">לפי המילון תוקנו: {fixedWords.join(", ")}</span>}
          {busy && text.length > 1500 && <span className="text-xs text-ink-3">טקסט ארוך, ההקראה יכולה לקחת עד שתי דקות…</span>}
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
