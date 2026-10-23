"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/field";

/** Saves still on their way to the server; submitting waits for them. */
const pending = new Set<Promise<unknown>>();

export function flushTextSaves() {
  return Promise.all([...pending]);
}

function saveText(attemptId: string, questionId: string, text: string): Promise<string | null> {
  const p = fetch(`/api/attempts/${attemptId}/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, text }),
    keepalive: text.length < 60_000,
  })
    .then(async (res) => (res.ok ? null : (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "השמירה נכשלה")))
    .catch(() => "אין חיבור לרשת. התשובה תישמר כשהחיבור יחזור.");
  pending.add(p);
  void p.finally(() => pending.delete(p));
  return p;
}

/** Answer typed on the keyboard, saved automatically a moment after the student stops typing. */
export function TypedAnswer(props: { attemptId: string; questionId: string; preview: boolean; initial: string; onChange: (text: string) => void }) {
  const [text, setText] = useState(props.initial);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | { error: string }>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(text);
  const savedText = useRef(props.initial);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = latest.current;
    if (value === savedText.current) return;
    if (props.preview) {
      savedText.current = value;
      setState("saved");
      return;
    }
    setState("saving");
    const error = await saveText(props.attemptId, props.questionId, value);
    if (error) setState({ error });
    else {
      savedText.current = value;
      setState(latest.current === value ? "saved" : "dirty");
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Leaving the question (or the page) saves what was typed.
  useEffect(() => () => void flushRef.current(), []);
  useEffect(() => {
    const retry = () => void flushRef.current();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  return (
    <div className="space-y-2">
      <label htmlFor={`typed-${props.questionId}`} className="sr-only">
        התשובה שלך
      </label>
      <Textarea
        id={`typed-${props.questionId}`}
        dir="auto"
        rows={8}
        value={text}
        placeholder="כתבו כאן את התשובה"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          latest.current = v;
          props.onChange(v);
          setState("dirty");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flushRef.current(), 1000);
        }}
        onBlur={() => void flush()}
        className="min-h-40 text-[16px] leading-relaxed"
      />
      <p className="flex items-center gap-1.5 text-sm" aria-live="polite">
        {typeof state === "object" ? (
          <span className="text-danger">{state.error}</span>
        ) : state === "saving" ? (
          <span className="flex items-center gap-1.5 text-ink-3">
            <Loader2 className="size-3.5 animate-spin" /> שומר…
          </span>
        ) : state === "saved" && text.trim() ? (
          <span className="flex items-center gap-1.5 font-medium text-ok">
            <CheckCircle2 className="size-4" /> התשובה נשמרה
          </span>
        ) : null}
      </p>
    </div>
  );
}
