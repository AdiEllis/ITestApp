import LZ from "lz-string";
import type { Exam, ExamLink, FeedbackLink, Submission } from "./types";

// ---------- links (data travels in the URL hash, which is never sent to any server) ----------

const BASE = () => `${location.origin}${import.meta.env.BASE_URL}`;

export function examLink(exam: Exam, className: string, teacher: string) {
  const payload: ExamLink = { v: 1, exam, className, teacher };
  return `${BASE()}#/x/${LZ.compressToEncodedURIComponent(JSON.stringify(payload))}`;
}
export function decodeExamLink(data: string): ExamLink | null {
  try {
    const p = JSON.parse(LZ.decompressFromEncodedURIComponent(data) ?? "") as ExamLink;
    return p?.v === 1 && p.exam?.sections ? p : null;
  } catch {
    return null;
  }
}
export function feedbackLink(f: FeedbackLink) {
  return `${BASE()}#/f/${LZ.compressToEncodedURIComponent(JSON.stringify(f))}`;
}
export function decodeFeedbackLink(data: string): FeedbackLink | null {
  try {
    const p = JSON.parse(LZ.decompressFromEncodedURIComponent(data) ?? "") as FeedbackLink;
    return p?.v === 1 ? p : null;
  } catch {
    return null;
  }
}

// ---------- blobs <-> base64 ----------

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type: mime });
}

// ---------- submission file ----------
// A self-contained .html file: it can be sent over WhatsApp/email/Classroom (HTML is a shareable
// type on phones), opened directly to listen, and imported into the teacher's page.

const MARK = "oralprep-submission";
type WireSubmission = Omit<Submission, "answers" | "importedAt" | "grading"> & {
  answers: Record<string, { mime: string; b64: string; durationSec: number; count: number }>;
  format: 1;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function packSubmission(s: Omit<Submission, "importedAt" | "grading">): Promise<Blob> {
  const wire: WireSubmission = { ...s, format: 1, answers: {} };
  for (const [qid, a] of Object.entries(s.answers)) wire.answers[qid] = { mime: a.mime, b64: await blobToBase64(a.data), durationSec: a.durationSec, count: a.count };
  const json = JSON.stringify(wire).replace(/</g, "\\u003c");
  const title = `${s.studentName} – ${s.exam.title}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>הגשה: ${esc(title)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#1a1c20;background:#f6f6f3}h1{font-size:20px}.q{background:#fff;border:1px solid #e4e3de;border-radius:12px;padding:12px;margin:10px 0}.en{direction:ltr;text-align:left}audio{width:100%;margin-top:8px}.n{color:#7b818b;font-size:14px}</style></head>
<body><h1>הגשה: ${esc(title)}</h1><p class="n">קובץ הגשה של OralPrep. המורה מייבאת אותו בעמוד "הגשות" ← "ייבוא קבצים". אפשר גם להאזין כאן.</p><div id="list"></div>
<script type="application/json" id="${MARK}">${json}</script>
<script>(function(){var d=JSON.parse(document.getElementById("${MARK}").textContent);var l=document.getElementById("list");d.exam.sections.forEach(function(s){s.questions.forEach(function(q){var a=d.answers[q.id];if(!a)return;var e=document.createElement("div");e.className="q";var t=document.createElement("div");t.className="en";t.textContent=s.title+" · "+(q.title||q.prompt);e.appendChild(t);var au=document.createElement("audio");au.controls=true;au.src="data:"+a.mime+";base64,"+a.b64;e.appendChild(au);l.appendChild(e);});});})();</script>
</body></html>`;
  return new Blob([html], { type: "text/html" });
}

export async function unpackSubmission(file: Blob): Promise<Submission> {
  const text = await file.text();
  const m = text.match(new RegExp(`<script type="application/json" id="${MARK}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error("הקובץ אינו קובץ הגשה של OralPrep");
  let wire: WireSubmission;
  try {
    wire = JSON.parse(m[1]);
  } catch {
    throw new Error("קובץ ההגשה פגום");
  }
  if (wire.format !== 1 || !wire.exam?.sections || !wire.studentName) throw new Error("קובץ ההגשה אינו תקין");
  const answers: Submission["answers"] = {};
  for (const [qid, a] of Object.entries(wire.answers ?? {})) answers[qid] = { mime: a.mime, data: base64ToBlob(a.b64, a.mime), durationSec: a.durationSec, count: a.count };
  const { format: _f, answers: _a, ...rest } = wire;
  return { ...rest, answers, importedAt: Date.now() };
}

export function submissionFileName(studentName: string, examTitle: string) {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 40);
  return `${clean(studentName)} - ${clean(examTitle)}.html`;
}

/** Share a file via the phone's share sheet (WhatsApp, Mail, Drive…); falls back to download. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename, text });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelled";
  }
  download(blob, filename);
  return "downloaded";
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
