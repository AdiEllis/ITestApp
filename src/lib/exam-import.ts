/**
 * Turns an exam file the teacher already has (Word, PDF or a photo of the page) into draft questions.
 * The teacher reviews and edits them before the exam is created; nothing here is final.
 *
 *  - With GEMINI_API_KEY set, a Gemini model reads the file (it also reads scanned pages and photos)
 *    and returns the questions as JSON, copied exactly as written.
 *  - Without it, or when the model fails, the text of a Word or PDF file is split into questions by
 *    their numbering ("1.", "שאלה 2", "א.").
 */

import { z } from "zod";
import { baseMime } from "./files";

export interface ParsedQuestion {
  prompt: string;
  subQuestions: string[];
  points: number | null;
}
export interface ParsedSection {
  title: string;
  instructions: string;
  questions: ParsedQuestion[];
}
export interface ParsedExam {
  title: string;
  description: string;
  sections: ParsedSection[];
  /** "ai": read by the model; "text": split by numbering. */
  method: "ai" | "text";
}

export class ImportError extends Error {}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Larger files are read by numbering only (the model's request limit is about 20MB). */
const AI_MAX_BYTES = 14 * 1024 * 1024;

export function canParse(mime: string) {
  const m = baseMime(mime);
  return m === DOCX || m === "application/pdf" || m === "image/png" || m === "image/jpeg" || m === "application/msword";
}

// ---------------- Text from the file ----------------

/** Bidi control marks that PDF and Word exports scatter through Hebrew text. */
const BIDI = /[‎‏‪-‮⁦-⁩﻿]/g;

async function docxText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

async function pdfText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).join("\n");
}

export async function extractText(buf: Buffer, mime: string): Promise<string> {
  const m = baseMime(mime);
  if (m === DOCX) return docxText(buf);
  if (m === "application/pdf") return pdfText(buf);
  return "";
}

// ---------------- Splitting by numbering ----------------

const POINTS = /\(?\s*(\d{1,3})\s*(?:נקודות|נקודה|נק['׳]?|points?|pts)\s*\)?/i;
const SECTION = /^(?:חלק|פרק|part|section)\s+\S{1,12}(?:\s*[-–:.]\s*.*)?$/i;
const QUESTION = [
  /^(?:שאלה|question)\s*(?:מס(?:פר|['׳])?\s*)?(\d{1,2})\s*[:.)\-–]?\s*(.*)$/i,
  /^(\d{1,2})\s*[.)]\s*(.+)$/,
  // PDF text of right-to-left pages sometimes puts the number at the far end: "…? 1." or ")3 …".
  /^\)(\d{1,2})\s+(.+)$/,
  /^(\d{1,2})\s*\(\s*([\u0590-\u05FF].+)$/,
  /^(.+?)\s+(\d{1,2})\s*[.)]$/,
];
const SUB = /^(?:([א-י])\s*['׳]?|([a-h]))\s*[.)]\s*(.+)$/i;

/** One line, with marks removed and punctuation that a PDF moved to the start put back at the end. */
function cleanLine(line: string) {
  let l = line.replace(BIDI, "").replace(/\s+/g, " ").trim();
  const lead = l.match(/^([.?!,:;]+)\s*(?=[\u0590-\u05FF])/);
  if (lead) l = `${l.slice(lead[0].length)}${lead[1]}`;
  return l.replace(/\s+([.?!,:;])$/, "$1");
}

function matchQuestion(line: string): string | null {
  for (const [i, re] of QUESTION.entries()) {
    const m = line.match(re);
    if (!m) continue;
    // The pattern with the number at the end captures the text first.
    const last = i === QUESTION.length - 1;
    const rest = (last ? m[1] : m[2]).trim();
    if (last && !/[\u0590-\u05FF]/.test(rest)) continue;
    return rest;
  }
  return null;
}

function takePoints(text: string): { text: string; points: number | null } {
  const m = text.match(POINTS);
  if (!m) return { text, points: null };
  const points = Number(m[1]);
  return { text: text.replace(m[0], " ").replace(/\s+/g, " ").replace(/\s+([?.!:,])/g, "$1").trim(), points: points > 0 && points <= 100 ? points : null };
}

export function splitByNumbering(raw: string): ParsedExam {
  const lines = raw.split(/\r?\n/).map(cleanLine);
  const sections: ParsedSection[] = [];
  let title = "";
  const intro: string[] = [];
  let section: ParsedSection | null = null;
  let question: ParsedQuestion | null = null;
  const ensureSection = () => {
    if (!section) {
      section = { title: "", instructions: "", questions: [] };
      sections.push(section);
    }
    return section;
  };

  for (const line of lines) {
    if (!line) continue;
    if (SECTION.test(line) && line.length <= 80) {
      section = { title: line, instructions: "", questions: [] };
      sections.push(section);
      question = null;
      continue;
    }
    const q = matchQuestion(line);
    if (q !== null) {
      const { text, points } = takePoints(q);
      question = { prompt: text, subQuestions: [], points };
      ensureSection().questions.push(question);
      continue;
    }
    const sub = line.match(SUB);
    if (sub && question) {
      const { text, points } = takePoints(sub[3]);
      question.subQuestions.push(text);
      if (points && !question.points) question.points = points;
      continue;
    }
    if (question?.subQuestions.length) {
      const subs = question.subQuestions;
      subs[subs.length - 1] = `${subs[subs.length - 1]} ${line}`;
    } else if (question) {
      question.prompt = question.prompt ? `${question.prompt}\n${line}` : line;
    } else if (section) {
      (section as ParsedSection).instructions = [(section as ParsedSection).instructions, line].filter(Boolean).join("\n");
    } else if (!title && line.length <= 100) {
      title = line;
    } else {
      intro.push(line);
    }
  }

  // No numbering at all: every paragraph becomes a question.
  if (!sections.some((s) => s.questions.length)) {
    const paragraphs = raw
      .replace(BIDI, "")
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map(cleanLine).filter(Boolean).join("\n"))
      .filter(Boolean);
    const body = paragraphs.length > 1 && paragraphs[0].length <= 100 ? paragraphs.slice(1) : paragraphs;
    return {
      title: paragraphs.length > 1 && paragraphs[0].length <= 100 ? paragraphs[0] : title,
      description: "",
      sections: [
        {
          title: "",
          instructions: "",
          questions: body.map((p) => {
            const { text, points } = takePoints(p);
            return { prompt: text, subQuestions: [], points };
          }),
        },
      ],
      method: "text",
    };
  }
  return { title, description: intro.join("\n"), sections: sections.filter((s) => s.questions.length || s.instructions), method: "text" };
}

// ---------------- Reading with Gemini ----------------

const aiSchema = z.object({
  title: z.string().default(""),
  instructions: z.string().default(""),
  sections: z
    .array(
      z.object({
        title: z.string().default(""),
        instructions: z.string().default(""),
        passage: z.string().default(""),
        questions: z.array(z.object({ prompt: z.string().default(""), subQuestions: z.array(z.string()).default([]), points: z.number().nullish() })).default([]),
      }),
    )
    .default([]),
});

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "The exam's title as written, or empty" },
    instructions: { type: "STRING", description: "General instructions to students at the top of the exam, or empty" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Part heading as written (e.g. חלק א'), or empty when the exam has no parts" },
          instructions: { type: "STRING", description: "Instructions for this part, or empty" },
          passage: { type: "STRING", description: "A reading passage or source text the questions of this part refer to, copied in full, or empty" },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                prompt: { type: "STRING", description: "The question text exactly as written, without its number" },
                subQuestions: { type: "ARRAY", items: { type: "STRING" }, description: "Sub-questions (א, ב, ג...) exactly as written, without their letters" },
                points: { type: "INTEGER", nullable: true, description: "Points for the question if written, else null" },
              },
              required: ["prompt", "subQuestions"],
            },
          },
        },
        required: ["title", "instructions", "passage", "questions"],
      },
    },
  },
  required: ["title", "instructions", "sections"],
};

const AI_PROMPT =
  "This file is a school exam written by a teacher (usually in Hebrew, sometimes Arabic or English). " +
  "Copy its questions so they can be read aloud to a student with a reading accommodation. " +
  "Copy every word exactly as written, including niqqud. Do not translate, correct, shorten, summarise, answer or add anything. " +
  "Drop question numbers and sub-question letters, and drop the points from the text (put them in `points`). " +
  "Keep multiple-choice options as sub-questions. Leave out answer lines, page numbers, headers, footers and the school's logo text. " +
  "If a question depends on a table, a chart or an image, describe nothing: copy only its text. " +
  "If the exam has no parts, return one section with an empty title.";

function geminiModels() {
  const forced = process.env.GEMINI_IMPORT_MODEL?.trim();
  return forced ? [forced] : ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
}

async function geminiOnce(model: string, parts: unknown[], timeoutMs: number): Promise<ParsedExam> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const data = aiSchema.parse(JSON.parse(text));
  return {
    title: data.title.trim(),
    description: data.instructions.trim(),
    method: "ai",
    sections: data.sections
      .map((s) => {
        const questions = s.questions
          .map((q) => ({
            prompt: q.prompt.trim(),
            subQuestions: q.subQuestions.map((x) => x.trim()).filter(Boolean),
            points: q.points && q.points > 0 && q.points <= 100 ? Math.round(q.points) : null,
          }))
          .filter((q) => q.prompt || q.subQuestions.length);
        // The passage is read to the student with the first question that refers to it.
        const passage = s.passage.trim();
        if (passage && questions[0]) questions[0] = { ...questions[0], prompt: `${passage}\n\n${questions[0].prompt}`.trim() };
        return { title: s.title.trim(), instructions: s.instructions.trim(), questions };
      })
      .filter((s) => s.questions.length),
  };
}

async function readWithGemini(parts: unknown[]): Promise<ParsedExam> {
  let last: unknown;
  // The page allows 60 seconds; leave time to split the text by numbering if the model fails.
  const deadline = Date.now() + 45_000;
  for (const model of geminiModels()) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    try {
      return await geminiOnce(model, parts, left);
    } catch (e) {
      last = e;
      console.error("[import]", (e as Error).message);
    }
  }
  throw last;
}

/** The draft questions for one uploaded file. */
export async function parseExamFile(buf: Buffer, mime: string): Promise<ParsedExam> {
  const m = baseMime(mime);
  if (m === "application/msword") throw new ImportError("קובצי Word ישנים (doc) לא נקראים אוטומטית. שמרו את הקובץ ב-Word בתור docx או PDF והעלו שוב.");
  const isImage = m === "image/png" || m === "image/jpeg";
  const ai = !!process.env.GEMINI_API_KEY?.trim();
  if (isImage && !ai) throw new ImportError("קריאת שאלות מתמונה דורשת את שירות Gemini, שלא הוגדר במערכת. העלו את המבחן כקובץ Word או PDF.");

  let text = "";
  try {
    text = await extractText(buf, m);
  } catch (e) {
    console.error("[import] text extraction failed", e);
  }

  if (ai) {
    try {
      // Word: send the text (the model doesn't read docx). PDF and photos: send the file itself, so
      // scanned pages and right-to-left layout are read as the student sees them.
      const parts =
        m === DOCX
          ? [{ text: AI_PROMPT }, { text: `--- The exam ---\n${text}` }]
          : buf.length <= AI_MAX_BYTES
            ? [{ text: AI_PROMPT }, { inline_data: { mime_type: m, data: buf.toString("base64") } }]
            : null;
      if (parts && (m !== DOCX || text.trim())) {
        const r = await readWithGemini(parts);
        if (r.sections.length) return r;
      }
    } catch {
      // Fall back to splitting the text by its numbering.
    }
  }
  if (!text.trim()) {
    throw new ImportError(
      isImage || m === "application/pdf"
        ? "לא הצלחנו לקרוא טקסט מהקובץ (ייתכן שזה דף סרוק). נסו שוב בעוד דקה, או העלו את המבחן כקובץ Word."
        : "לא נמצא טקסט בקובץ.",
    );
  }
  return splitByNumbering(text);
}
