import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

/**
 * Simulation mode: preparation countdown, automatic recording start/stop,
 * and automatic submission when the overall time limit expires.
 * Timings are shortened through the DB to keep the test fast.
 */
const db = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_e2e?schema=public" });
const FIX = path.join(__dirname, ".tmp", "fixtures");
test.afterAll(() => db.$disconnect());

test("simulation: prep timer → auto record → auto stop → time limit → auto submit", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  const t = await ctx.newPage();
  const email = `sim.${Date.now()}@school.test`;
  await t.goto("/register");
  await t.locator("#name").fill("Sim Teacher");
  await t.locator("#email").fill(email);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("Sim School");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);

  await t.goto("/t/classes");
  await t.locator("#name").fill("Sim class");
  await t.getByRole("button", { name: "יצירת כיתה" }).click();
  await t.locator("#names").fill("Sim Student");
  await t.getByRole("button", { name: "יצירת חשבונות" }).click();
  const cells = t.locator("#credentials tbody tr").first().locator("td");
  const username = (await cells.nth(1).textContent())!.trim();
  const tempPw = (await cells.nth(2).textContent())!.trim();

  await t.goto("/t/exams/new");
  await t.getByRole("button", { name: /בגרות בעל פה באנגלית/ }).click();
  await t.locator("#title").fill("Timed simulation");
  await t.getByRole("button", { name: "יצירה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/exams\/(?!new$)\w+$/);
  const examId = t.url().split("/").pop()!;
  await t.locator('input[type=file][accept^="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4"]').setInputFiles(path.join(FIX, "clip.webm"));
  await expect(t.locator('video[src^="/api/media/"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(t.getByText("שינויים לא שמורים")).toBeVisible();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Shorten timings for the test: 3s prep, 10s max recording.
  await db.question.updateMany({ where: { section: { examId } }, data: { prepTimeSec: 3, maxRecordSec: 10 } });
  await t.reload();
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText("המבחן פורסם")).toBeVisible();
  await t.getByRole("link", { name: "הקצאה לכיתה" }).click();
  await t.getByRole("button", { name: "הקצאה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/assignments\/\w+$/);

  const sctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 390, height: 844 }, isMobile: true });
  const s = await sctx.newPage();
  await s.goto("/login");
  await s.locator("#identifier").fill(username);
  await s.locator("#password").fill(tempPw);
  await s.getByRole("button", { name: "התחברות" }).click();
  await s.locator("#current").fill(tempPw);
  await s.locator("#password").fill("Student-pass9");
  await s.locator("#confirm").fill("Student-pass9");
  await s.getByRole("button", { name: "שמירת סיסמה" }).click();
  await s.getByText("Timed simulation").click();
  await expect(s.getByText("זמן כולל: 30 דקות")).toBeVisible();
  // Simulation requires the mic check before starting.
  await expect(s.getByRole("button", { name: "התחלת המבחן" })).toBeDisabled();
  await s.getByRole("button", { name: "הפעלת מיקרופון" }).click();
  await s.getByRole("button", { name: /הקלטת ניסיון/ }).click();
  await s.getByRole("button", { name: "שמעתי את עצמי — הכול תקין" }).click({ timeout: 15_000 });
  await s.getByRole("button", { name: "התחלת המבחן" }).click();
  await expect(s).toHaveURL(/\/run$/);
  await expect(s.getByRole("timer")).toBeVisible();

  await s.getByRole("button", { name: /spend your free time/ }).click();
  await expect(s.getByText("זמן הכנה")).toBeVisible();
  // Recording starts by itself after prep and stops by itself at the 10s limit.
  await expect(s.getByText("מקליט", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(s.getByText("התשובה נשמרה")).toBeVisible({ timeout: 20_000 });
  // No back navigation in simulation mode.
  await expect(s.getByRole("button", { name: "הקודם" })).toBeDisabled();

  // Time limit: move the deadline close, reload, and wait for auto-submit.
  const attemptId = s.url().split("/").at(-2)!;
  await db.attempt.update({ where: { id: attemptId }, data: { deadlineAt: new Date(Date.now() + 5000) } });
  await s.reload();
  await expect(s).toHaveURL(new RegExp(`/s/attempts/${attemptId}\\?submitted=1`), { timeout: 30_000 });
  const attempt = await db.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
  expect(attempt.status).toBe("SUBMITTED");
  expect(attempt.answers.filter((a) => a.recordingId)).toHaveLength(1);
  expect(attempt.answers[0].durationSec).toBeLessThanOrEqual(11);
  await sctx.close();
  await ctx.close();
});
