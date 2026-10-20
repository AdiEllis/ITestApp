import { describe, expect, it } from "vitest";
import { friendlyCode, signToken, tempPassword, verifyToken } from "@/lib/crypto";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { passwordProblem } from "@/lib/auth";

describe("signed tokens", () => {
  const secret = "x".repeat(40);
  it("round-trips", () => {
    const t = signToken({ k: "a/b.webm" }, secret, 60);
    expect(verifyToken<{ k: string }>(t, secret)?.k).toBe("a/b.webm");
  });
  it("rejects tampering and wrong secret", () => {
    const t = signToken({ k: "a" }, secret, 60);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "other", exp: 9999999999 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyToken(t, "y".repeat(40))).toBeNull();
    expect(verifyToken(`${body}`, secret)).toBeNull();
  });
  it("rejects expired tokens", () => {
    expect(verifyToken(signToken({ k: "a" }, secret, -5), secret)).toBeNull();
  });
});

describe("codes & passwords", () => {
  it("friendly codes avoid ambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(friendlyCode(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it("temporary passwords satisfy the password policy", () => {
    for (let i = 0; i < 50; i++) expect(passwordProblem(tempPassword())).toBeNull();
  });
  it("password policy", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("onlyletters")).not.toBeNull();
    expect(passwordProblem("letters123")).toBeNull();
  });
});

describe("Israel-time datetime-local conversion", () => {
  it("round-trips in winter and summer time", () => {
    for (const v of ["2026-01-15T08:30", "2026-07-15T08:30"]) expect(toLocalInput(fromLocalInput(v))).toBe(v);
  });
  it("applies the correct offset", () => {
    expect(fromLocalInput("2026-01-15T10:00")!.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(fromLocalInput("2026-07-15T10:00")!.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });
});
