// Integration tests run against a dedicated database (never the dev DB).
// One connection, as on Vercel (src/lib/db.ts): a query outside a transaction's client then deadlocks here too.
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_test?schema=public");
testUrl.searchParams.set("connection_limit", "1");
testUrl.searchParams.set("pool_timeout", "5");
process.env.DATABASE_URL = testUrl.toString();
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = "./storage-test";
