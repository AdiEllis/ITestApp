import { all, put, settings } from "./store";
import { base64ToBlob, blobToBase64 } from "./codec";
import type { Exam, Submission } from "./types";

/** Full teacher backup (exams, submissions incl. recordings, settings) as one JSON file. */
export async function exportBackup(): Promise<Blob> {
  const exams = await all<Exam>("exams");
  const subs = await all<Submission>("submissions");
  const wireSubs = [];
  for (const s of subs) {
    const answers: Record<string, unknown> = {};
    for (const [q, a] of Object.entries(s.answers)) answers[q] = { ...a, data: await blobToBase64(a.data) };
    wireSubs.push({ ...s, answers });
  }
  const data = {
    app: "oralprep-lite",
    version: 1,
    exportedAt: Date.now(),
    exams,
    submissions: wireSubs,
    settings: { rubric: await settings.rubric(), teacherName: await settings.teacherName(), classes: await settings.classes() },
  };
  await settings.setLastBackup(Date.now());
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

export async function importBackup(file: Blob) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("קובץ הגיבוי אינו תקין");
  }
  if (data?.app !== "oralprep-lite") throw new Error("זה אינו קובץ גיבוי של OralPrep");
  let e = 0;
  let s = 0;
  for (const exam of data.exams ?? []) {
    await put("exams", exam.id, exam);
    e++;
  }
  for (const sub of data.submissions ?? []) {
    const answers: Submission["answers"] = {};
    for (const [q, a] of Object.entries(sub.answers as Record<string, { mime: string; data: string; durationSec: number; count: number }>))
      answers[q] = { ...a, data: base64ToBlob(a.data, a.mime) };
    await put("submissions", sub.id, { ...sub, answers });
    s++;
  }
  if (data.settings?.rubric) await settings.setRubric(data.settings.rubric);
  if (data.settings?.teacherName) await settings.setTeacherName(data.settings.teacherName);
  if (data.settings?.classes) await settings.setClasses(data.settings.classes);
  return { exams: e, submissions: s };
}
