import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseExamFile, splitByNumbering } from "@/lib/exam-import";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("splitByNumbering", () => {
  it("splits numbered questions, sub-questions, parts and points", () => {
    const r = splitByNumbering(
      [
        "מבחן בהיסטוריה",
        "ענו על כל השאלות.",
        "חלק א'",
        "1. מה היו הגורמים למלחמה? (20 נקודות)",
        "2) הסבירו את המושג לאומיות.",
        "א. מהי לאומיות?",
        "ב. תנו דוגמה.",
        "המשך השאלה בשורה נוספת",
        "חלק ב'",
        "שאלה 3: תארו את התקופה.",
      ].join("\n"),
    );
    expect(r.title).toBe("מבחן בהיסטוריה");
    expect(r.description).toBe("ענו על כל השאלות.");
    expect(r.sections.map((s) => s.title)).toEqual(["חלק א'", "חלק ב'"]);
    expect(r.sections[0].questions[0]).toEqual({ prompt: "מה היו הגורמים למלחמה?", subQuestions: [], points: 20 });
    expect(r.sections[0].questions[1]).toEqual({ prompt: "הסבירו את המושג לאומיות.", subQuestions: ["מהי לאומיות?", "תנו דוגמה. המשך השאלה בשורה נוספת"], points: null });
    expect(r.sections[1].questions[0].prompt).toBe("תארו את התקופה.");
  });

  it("repairs right-to-left PDF text: marks, numbers at the end, punctuation at the start", () => {
    const r = splitByNumbering("‫מה למדתם מהקטע? (‪ 10‬ נקודות) ‪1.‬‬\n)2 תארו את העמדה\n.ב. סעיף ראשון");
    expect(r.sections[0].questions.map((q) => q.prompt)).toEqual(["מה למדתם מהקטע?", "תארו את העמדה"]);
    expect(r.sections[0].questions[0].points).toBe(10);
  });

  it("makes every paragraph a question when nothing is numbered", () => {
    const r = splitByNumbering("כותרת\n\nספרו על עצמכם.\n\nמה התחביב שלכם?");
    expect(r.title).toBe("כותרת");
    expect(r.sections[0].questions.map((q) => q.prompt)).toEqual(["ספרו על עצמכם.", "מה התחביב שלכם?"]);
  });
});

describe("parseExamFile", () => {
  const docx = readFileSync(path.join(__dirname, "../../e2e/fixtures/history-exam.docx"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads a Word file by its numbering without a Gemini key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const r = await parseExamFile(docx, DOCX);
    expect(r.method).toBe("text");
    expect(r.sections.flatMap((s) => s.questions)).toHaveLength(5);
  });

  it("asks Gemini when a key is set, keeps niqqud and puts a passage before the first question", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const answer = {
      title: "מבחן",
      instructions: "",
      sections: [{ title: "", instructions: "", passage: "קֶטַע", questions: [{ prompt: "מָה לְמַדְתֶּם?", subQuestions: [" א "], points: 30 }, { prompt: "", subQuestions: [] }] }],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const r = await parseExamFile(Buffer.from("%PDF-1.4 fake"), "application/pdf");
    expect(r.method).toBe("ai");
    expect(r.sections[0].questions).toEqual([{ prompt: "קֶטַע\n\nמָה לְמַדְתֶּם?", subQuestions: ["א"], points: 30 }]);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe("application/pdf");
  });

  it("falls back to the numbering when Gemini fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    const r = await parseExamFile(docx, DOCX);
    expect(r.method).toBe("text");
    expect(r.sections.flatMap((s) => s.questions)).toHaveLength(5);
  });

  it("explains what to do with old .doc files and photos without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(parseExamFile(Buffer.from("x"), "application/msword")).rejects.toThrow(/docx/);
    await expect(parseExamFile(Buffer.from("x"), "image/png")).rejects.toThrow(/Word או PDF/);
  });
});
