import { describe, expect, it } from "vitest";
import { audioMatchesText, detectLanguage, spokenText } from "@/lib/exam-types";
import { synthesize, type TtsError } from "@/lib/tts";
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

describe("Azure voice errors", () => {
  const env = { ...process.env };
  const withAzure = (region: string) => {
    process.env.TTS_PROVIDER = "";
    process.env.AZURE_SPEECH_KEY = " key ";
    process.env.AZURE_SPEECH_REGION = region;
  };
  const reason = async () => synthesize("שלום").then(() => "ok", (e: TtsError) => e.reason);

  it("a rejected key, a wrong region and a slow service each get their own reason", async () => {
    const orig = globalThis.fetch;
    try {
      withAzure("North Europe");
      let url = "";
      globalThis.fetch = (async (u: string, init: RequestInit) => {
        url = u;
        expect((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("key");
        return new Response("Unauthorized", { status: 401 });
      }) as typeof fetch;
      expect(await reason()).toBe("key");
      expect(url).toBe("https://northeurope.tts.speech.microsoft.com/cognitiveservices/v1");

      globalThis.fetch = (async () => {
        throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
      }) as typeof fetch;
      expect(await reason()).toBe("region");

      globalThis.fetch = (async () => {
        throw new DOMException("timed out", "TimeoutError");
      }) as typeof fetch;
      expect(await reason()).toBe("timeout");

      withAzure("north-europe!");
      expect(await reason()).toBe("region");

      withAzure("northeurope");
      globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as typeof fetch;
      expect(await reason()).toBe("ok");
    } finally {
      globalThis.fetch = orig;
      process.env = env;
    }
  });
});

describe("S3 settings", () => {
  it("tidies pasted values and takes the Backblaze region from the endpoint", async () => {
    const { s3Settings, describeStorageError } = await import("@/lib/storage/s3");
    const c = s3Settings({ S3_ENDPOINT: " s3.us-east-005.backblazeb2.com/ ", S3_REGION: "auto", S3_BUCKET: " b ", S3_ACCESS_KEY_ID: " id ", S3_SECRET_ACCESS_KEY: "k\n" } as unknown as NodeJS.ProcessEnv);
    expect(c).toEqual({ endpoint: "https://s3.us-east-005.backblazeb2.com", region: "us-east-005", bucket: "b", accessKeyId: "id", secretAccessKey: "k" });
    expect(describeStorageError({ name: "SignatureDoesNotMatch" })).toContain("S3_SECRET_ACCESS_KEY");
    expect(describeStorageError({ name: "NoSuchBucket" })).toContain("(קוד: NoSuchBucket)");
  });
});
