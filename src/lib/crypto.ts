import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Human-friendly code without ambiguous characters (0/O, 1/I/L). */
export function friendlyCode(length = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Readable temporary password, e.g. "kite-4821-moon". */
export function tempPassword(): string {
  const words = ["sun", "moon", "kite", "river", "cloud", "lamp", "tree", "stone", "wave", "star", "leaf", "bird", "road", "hill", "snow", "rain"];
  const b = randomBytes(4);
  const n = (b.readUInt16BE(0) % 9000) + 1000;
  return `${words[b[2] % words.length]}-${n}-${words[b[3] % words.length]}`;
}

/** HMAC-signed, expiring token: base64url(payload).signature */
export function signToken(payload: Record<string, unknown>, secret: string, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string, secret: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data as T;
  } catch {
    return null;
  }
}
