import { describe, expect, it } from "vitest";
import { audioMatchesText, detectLanguage, spokenText } from "@/lib/exam-types";
import { synthesize } from "@/lib/tts";
import { sniff } from "@/lib/files";
import { buildSebConfig, isInSeb, sebMarker, assertSebIfRequired } from "@/lib/seb";
import { sha256 } from "@/lib/crypto";

describe("read-aloud text", () => {
  it("reads the question and numbered follow-up questions, or the teacher's reading text", () => {
    expect(spokenText({ prompt: "מה גרם למלחמה?", subQuestions: ["הסבירו", " ", "תנו דוגמה"] })).toBe("מה גרם למלחמה?\n1. הסבירו\n2. תנו דוגמה");
    expect(spokenText({ prompt: "ספר", subQuestions: [], readText: " סֵפֶר " })).toBe("סֵפֶר");
  });

  it("detects audio made for an older version of the question", () => {
    const q = { prompt: "שאלה", subQuestions: [], readText: null, audioText: "שאלה" };
    expect(audioMatchesText(q)).toBe(true);
    expect(audioMatchesText({ ...q, prompt: "שאלה אחרת" })).toBe(false);
    // audio from before this feature has no recorded text and is kept as is
    expect(audioMatchesText({ ...q, audioText: null, prompt: "x" })).toBe(true);
  });

  it("picks the voice language from the text", () => {
    expect(detectLanguage("מה היו הגורמים למלחמה?")).toBe("he-IL");
    expect(detectLanguage("Tell me about your project")).toBe("en-US");
    expect(detectLanguage("ما هو اسمك؟")).toBe("ar-SA");
    expect(detectLanguage("הסבירו את המושג Renaissance")).toBe("he-IL");
  });

  it("the test voice produces a real audio file the upload checks accept", async () => {
    process.env.TTS_PROVIDER = "fake";
    const r = await synthesize("שלום עולם");
    expect(r.mimeType).toBe("audio/wav");
    expect(sniff(r.audio)).toBe("wav");
    delete process.env.TTS_PROVIDER;
  });
});

describe("Safe Exam Browser", () => {
  const a = { id: "asg1", sebKey: "secret-key", sebQuitPassword: "123456" };

  it("recognises only SEB started with this assignment's file", () => {
    const ua = `Mozilla/5.0 (Windows NT 10.0) Chrome/147 SEB/3.10 ${sebMarker("secret-key")}`;
    expect(isInSeb(ua, "secret-key")).toBe(true);
    expect(isInSeb("Mozilla/5.0 Chrome/147", "secret-key")).toBe(false);
    expect(isInSeb(`x ${sebMarker("other")}`, "secret-key")).toBe(false);
    expect(isInSeb(ua, null)).toBe(false);
    expect(() => assertSebIfRequired({ requireSeb: true, sebKey: "secret-key" }, "Chrome")).toThrow(/Safe Exam Browser/);
    expect(() => assertSebIfRequired({ requireSeb: false, sebKey: null }, "Chrome")).not.toThrow();
  });

  it("builds a config that opens only our site, allows the mic and hides the quit password", () => {
    const xml = buildSebConfig(a, { googleSignIn: true, appUrl: "https://school.example.org" });
    expect(xml.startsWith("<?xml")).toBe(true);
    const value = (key: string) => xml.match(new RegExp(`<key>${key}</key>\\s*<([a-z]+)>?([^<]*)`))?.slice(1);
    expect(value("startURL")).toEqual(["string", "https://school.example.org/s/assignments/asg1"]);
    expect(value("browserUserAgent")).toEqual(["string", "OralPrepSEB/secret-key"]);
    expect(value("sebConfigPurpose")).toEqual(["integer", "0"]);
    expect(value("hashedQuitPassword")).toEqual(["string", sha256("123456")]);
    expect(xml).not.toContain("<string>123456</string>");
    expect(xml).toMatch(/<key>allowAudioCapture<\/key>\s*<true\/>/);
    expect(xml).toMatch(/<key>URLFilterEnable<\/key>\s*<true\/>/);
    expect(xml).toContain("<string>school.example.org</string>");
    expect(xml).toContain("<string>accounts.google.com</string>");
    expect(value("quitURL")).toEqual(["string", "https://school.example.org/seb/quit"]);
    // well-formed: every opened dict/array is closed
    for (const tag of ["dict", "array", "plist"]) expect(xml.split(`<${tag}`).length).toBe(xml.split(`</${tag}>`).length);
  });
});
