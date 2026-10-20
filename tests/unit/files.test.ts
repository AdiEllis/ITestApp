import { describe, expect, it } from "vitest";
import { checkContent, checkDeclared, sniff } from "@/lib/files";

const buf = (...bytes: (number | string)[]) =>
  Buffer.concat(bytes.map((b) => (typeof b === "string" ? Buffer.from(b, "latin1") : Buffer.from([b]))));

describe("content sniffing", () => {
  it("detects common formats", () => {
    expect(sniff(buf(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0))).toBe("webm");
    expect(sniff(buf(0, 0, 0, 0x20, "ftypM4A ", 0, 0))).toBe("mp4");
    expect(sniff(buf("%PDF-1.7\n"))).toBe("pdf");
    expect(sniff(buf("ID3", 4, 0, 0))).toBe("mp3");
    expect(sniff(buf("RIFF", 0, 0, 0, 0, "WAVE"))).toBe("wav");
    expect(sniff(buf(0x50, 0x4b, 3, 4, 0))).toBe("zip");
    expect(sniff(buf("<html><script>"))).toBeNull();
  });
});

describe("declared type / size checks", () => {
  it("rejects disallowed types", () => {
    expect(checkDeclared("RECORDING", "text/html", 100)).toMatch(/אינו נתמך/);
    expect(checkDeclared("SOURCE_DOCUMENT", "application/x-msdownload", 100)).toMatch(/אינו נתמך/);
  });
  it("rejects empty and oversized files", () => {
    expect(checkDeclared("RECORDING", "audio/webm", 0)).toMatch(/ריק/);
    expect(checkDeclared("RECORDING", "audio/webm", 31 * 1024 * 1024)).toMatch(/גדול/);
  });
  it("accepts recordings from Chrome and Safari", () => {
    expect(checkDeclared("RECORDING", "audio/webm;codecs=opus", 5000)).toBeNull();
    expect(checkDeclared("RECORDING", "audio/mp4", 5000)).toBeNull();
  });
  it("rejects content that does not match the declared type (e.g. HTML renamed to .pdf)", () => {
    expect(checkContent("SOURCE_DOCUMENT", "application/pdf", buf("<html>evil</html>"))).not.toBeNull();
    expect(checkContent("SOURCE_DOCUMENT", "application/pdf", buf("%PDF-1.4 ..."))).toBeNull();
    expect(checkContent("RECORDING", "audio/webm", buf(0, 0, 0, 0x20, "ftypisom"))).not.toBeNull();
  });
});
