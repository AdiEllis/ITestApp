import { createHash } from "node:crypto";
import { randomToken } from "./crypto";

/** Minimal Google OpenID Connect (authorization code + PKCE). No third-party library. */

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export function pkce() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authUrl(opts: { redirectUri: string; state: string; challenge: string; loginHint?: string }) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  if (opts.loginHint) u.searchParams.set("login_hint", opts.loginHint);
  return u.toString();
}

/**
 * Validates the claims of an ID token received directly from Google's token endpoint over TLS.
 * (OIDC Core 3.1.3.7: signature validation may be replaced by TLS server validation in this flow.)
 */
export function profileFromIdToken(idToken: string, clientId: string, now = Date.now()): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("bad id_token");
  const c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new Error("bad issuer");
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(clientId)) throw new Error("bad audience");
  if (typeof c.exp !== "number" || c.exp * 1000 < now - 60_000) throw new Error("expired");
  if (typeof c.sub !== "string" || typeof c.email !== "string") throw new Error("missing claims");
  return {
    sub: c.sub,
    email: c.email.toLowerCase(),
    emailVerified: c.email_verified === true || c.email_verified === "true",
    name: (typeof c.name === "string" && c.name.trim()) || c.email.split("@")[0],
  };
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("no id_token");
  return profileFromIdToken(data.id_token, process.env.GOOGLE_CLIENT_ID!);
}
