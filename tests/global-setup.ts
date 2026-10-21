import { execSync } from "node:child_process";

/** Keeps the dedicated test database on the latest schema. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_test?schema=public";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
