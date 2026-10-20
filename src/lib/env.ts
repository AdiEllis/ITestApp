function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    const s = required("APP_SECRET");
    if (s.length < 32) throw new Error("APP_SECRET must be at least 32 characters");
    return s;
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
