import { createHash } from "node:crypto";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get appUrl() {
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
    return (process.env.APP_URL ?? vercel ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    const s = process.env.APP_SECRET;
    if (s) {
      if (s.length < 32) throw new Error("APP_SECRET must be at least 32 characters");
      return s;
    }
    // Fallback for simple hosted setups: derive a stable secret from other secrets that are always present.
    const material = (process.env.S3_SECRET_ACCESS_KEY ?? "") + "|" + required("DATABASE_URL");
    if (material.length < 40) throw new Error("Set APP_SECRET (at least 32 characters)");
    return createHash("sha256").update("oralprep-app-secret|" + material).digest("base64url");
  },
  get allowTeacherSignup() {
    return (process.env.ALLOW_TEACHER_SIGNUP ?? "true") === "true";
  },
  get storageDriver(): "local" | "s3" {
    return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  },
  get storageLocalDir() {
    return process.env.STORAGE_LOCAL_DIR ?? "./storage";
  },
  get defaultRetentionDays() {
    const n = Number(process.env.DEFAULT_RECORDING_RETENTION_DAYS ?? "400");
    return Number.isFinite(n) && n >= 0 ? n : 400;
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
