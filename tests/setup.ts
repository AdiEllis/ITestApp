// Integration tests run against a dedicated database (never the dev DB).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_test?schema=public";
process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = "./storage-test";
