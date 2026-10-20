import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_e2e?schema=public";

/** Chromium with a fake microphone: getUserMedia returns a real generated audio tone. */
const fakeMic = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["microphone"],
        launchOptions: { args: fakeMic, executablePath: process.env.PW_CHROMIUM_PATH },
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: DB,
      APP_URL: `http://localhost:${PORT}`,
      APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "./e2e/.tmp/storage",
      ALLOW_TEACHER_SIGNUP: "true",
    },
  },
});
