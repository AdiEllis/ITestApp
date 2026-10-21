import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173/ITestApp/", locale: "he-IL", timezoneId: "Asia/Jerusalem", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], permissions: ["microphone"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } } },
    },
  ],
  webServer: { command: "npx vite build && npx vite preview --port 4173 --strictPort", url: "http://localhost:4173/ITestApp/", timeout: 120_000, reuseExistingServer: false },
});
