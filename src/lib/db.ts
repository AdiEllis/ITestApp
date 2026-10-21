import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Serverless hosts (Vercel) + a pooled Postgres URL (e.g. Neon "-pooler" host) need
 * pgbouncer mode and a single connection per function instance.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (process.env.VERCEL && !u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return url;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: datasourceUrl(), log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
