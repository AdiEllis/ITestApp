// Build used by Vercel ("vercel-build"): migrate the database, seed defaults, configure storage, build.
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

if (process.env.STORAGE_DRIVER !== "s3") {
  console.error("\n✖ On Vercel, STORAGE_DRIVER must be \"s3\" (the server disk is not persistent). See docs/FREE-SETUP.md\n");
  process.exit(1);
}
run("npx prisma generate");
// Migrations need a direct (non-pooled) connection when one is available (Neon sets DATABASE_URL_UNPOOLED).
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
run("npx prisma migrate deploy", { DATABASE_URL: direct });
run("npx tsx prisma/seed.ts", { DATABASE_URL: direct });
run("npx tsx scripts/setup-storage.ts");
run("npx next build");
