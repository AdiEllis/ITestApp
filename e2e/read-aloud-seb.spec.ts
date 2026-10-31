import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Any-subject exam with read-aloud and a classroom exam in Safe Exam Browser:
 * the teacher writes a Hebrew question, creates the automatic reading, must approve it before
 * publishing, assigns it as a locked classroom exam and downloads the SEB file. A student in a
 * regular browser is refused; the same student "inside SEB" (the file's user agent) takes the exam.
 */

const PW = "Teach3r-pass";
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(__dirname, ".tmp", "screens", `${name}.png`), fullPage: true });

async function setup(page: Page) {
  await page.goto("/register");
  await page.locator("#name").fill("History Teacher");
  await page.locator("#email").fill(`hist.${Date.now()}@school.test`);
  await page.locator("#password").fill(PW);
  await page.locator("#schoolName").fill("History School");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(page).toHaveURL(/\/t$/);
  await page.goto("/t/classes");
  await page.locator("#name").fill("י״א 2");
  await page.getByRole("button", { name: "יצירת כיתה" }).click();
  await page.locator("#names").fill("Maya Read");
  await page.getByRole("button", { name: "יצירת חשבונות" }).click();
  const cells = page.locator("#credentials tbody tr").first().locator("td");
  return { username: (await cells.nth(1).textContent())!.trim(), password: (await cells.nth(2).textContent())!.trim() };
}

test("read-aloud must be approved; a classroom exam opens only in Safe Exam Browser", async ({ browser }) => {
  test.setTimeout(180_000);
  const tctx = await browser.newContext({ permissions: ["microphone"], locale: "he-IL", acceptDownloads: true });
  const t = await tctx.newPage();
  const student = await setup(t);

  // New exam in any subject (the default choice).
  await t.goto("/t/exams/new");
  await t.locator("#title").fill("מלחמת העולם הראשונה");
  await t.locator("#subject").fill("היסטוריה");
  await t.getByRole("button", { name: "יצירה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/exams\/(?!new$)\w+$/);
  const examUrl = t.url();
  await expect(t.locator("#subject")).toHaveValue("היסטוריה");

  const question = "מה היו הגורמים לפרוץ מלחמת העולם הראשונה?";
  await t.getByLabel("השאלה", { exact: true }).fill(question);
  await expect(t.getByText("אין עדיין הקראה")).toBeVisible();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });

  // No reading yet: publishing is refused with a clear reason.
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText("לא ניתן לפרסם עדיין")).toBeVisible();
  await expect(t.getByText(/אין עדיין הקראה. צרו הקראה אוטומטית/)).toBeVisible();

  // Automatic reading → must be listened to and approved.
  await t.getByRole("button", { name: "יצירת הקראה אוטומטית" }).click();
  await expect(t.getByText("צריך להאזין ולאשר")).toBeVisible({ timeout: 20_000 });
  await expect(t.locator('audio[src^="/api/media/"]').first()).toBeVisible();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText(/להאזין להקראה של שאלה 1/)).toBeVisible();

  await t.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון").check();
  await expect(t.getByText("ההקראה אושרה")).toBeVisible();

  // Changing the question after the reading was made invalidates it.
  await t.getByLabel("השאלה", { exact: true }).fill(question + " הסבירו.");
  await expect(t.getByText("השאלה השתנתה, צריך הקראה חדשה")).toBeVisible();
  await t.getByRole("button", { name: "יצירת הקראה אוטומטית מחדש" }).click();
  await expect(t.getByText("צריך להאזין ולאשר")).toBeVisible({ timeout: 20_000 });
  await t.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון").check();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
  await shot(t, "20-builder-read-aloud");
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText("המבחן פורסם")).toBeVisible();

  // Assign as a locked classroom exam with a chosen quit password.
  await t.getByRole("link", { name: "שליחה לכיתה" }).click();
  await t.getByText("בכיתה, במחשב נעול").click();
  await t.locator("#sebQuitPassword").fill("4321");
  await expect(t.getByLabel("לשלוח לתלמידים מייל על המבחן החדש")).toBeChecked();
  await shot(t, "21-assign-classroom");
  await t.getByRole("button", { name: "שליחה לכיתה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/assignments\/\w+$/);
  const assignmentId = t.url().split("/").pop()!;
  await expect(t.getByText("סיסמת יציאה למשגיח/ה:")).toBeVisible();
  await expect(t.getByText("4321")).toBeVisible();
  await shot(t, "22-assignment-seb");

  const [download] = await Promise.all([t.waitForEvent("download"), t.getByRole("link", { name: "הורדת קובץ הפתיחה למבחן" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.seb$/);
  const seb = readFileSync((await download.path())!, "utf8");
  expect(seb).toContain(`/s/assignments/${assignmentId}</string>`);
  expect(seb).not.toContain("4321");
  const marker = seb.match(/<key>browserUserAgent<\/key>\s*<string>([^<]+)<\/string>/)![1];
  expect(marker).toMatch(/^OralPrepSEB\//);

  // Student in a regular browser: refused.
  const plain = await browser.newContext({ permissions: ["microphone"], locale: "he-IL" });
  const sp = await plain.newPage();
  await sp.goto("/login");
  await sp.locator("#identifier").fill(student.username);
  await sp.locator("#password").fill(student.password);
  await sp.getByRole("button", { name: "התחברות" }).click();
  await sp.locator("#current").fill(student.password);
  await sp.locator("#password").fill("Student-pass1");
  await sp.locator("#confirm").fill("Student-pass1");
  await sp.getByRole("button", { name: "שמירת סיסמה" }).click();
  await expect(sp).toHaveURL(/\/s$/);
  await sp.goto(`/s/assignments/${assignmentId}`);
  await expect(sp.getByText(/את המבחן הזה עושים רק בכיתה/)).toBeVisible();
  await expect(sp.getByRole("button", { name: "התחלת המבחן" })).toHaveCount(0);
  await shot(sp, "23-student-blocked");
  await plain.close();

  // The same student inside SEB (its user agent carries the file's marker): the exam opens.
  const ua = (await t.evaluate(() => navigator.userAgent)) + " SEB/3.10.2 " + marker;
  const sebCtx = await browser.newContext({ permissions: ["microphone"], locale: "he-IL", userAgent: ua });
  const s = await sebCtx.newPage();
  await s.goto(`/s/assignments/${assignmentId}`);
  await expect(s).toHaveURL(/\/login/);
  await s.locator("#identifier").fill(student.username);
  await s.locator("#password").fill("Student-pass1");
  await s.getByRole("button", { name: "התחברות" }).click();
  // After signing in, SEB's start page (the assignment) opens.
  await expect(s).toHaveURL(new RegExp(`/s/assignments/${assignmentId}$`));
  await s.getByRole("button", { name: /דילוג/ }).click();
  await s.getByRole("button", { name: "התחלת המבחן" }).click();
  await expect(s).toHaveURL(/\/run$/);

  // The student hears the approved reading and sees the question.
  await expect(s.getByText("האזינו לשאלה")).toBeVisible();
  await expect(s.locator('audio[aria-label="הקראת השאלה"]')).toHaveAttribute("src", /\/api\/media\//);
  await expect(s.getByRole("heading", { name: /הגורמים לפרוץ מלחמת העולם הראשונה/ })).toBeVisible();
  await shot(s, "24-student-question");
  await s.getByRole("button", { name: "התחלת הקלטה" }).click();
  await s.waitForTimeout(2500);
  await s.getByRole("button", { name: "סיום הקלטה" }).click();
  await expect(s.getByText("התשובה נשמרה")).toBeVisible({ timeout: 20_000 });
  await s.getByRole("button", { name: "סיום והגשה" }).click();
  await s.getByRole("button", { name: "הגשת המבחן" }).click();
  await s.getByRole("button", { name: "הגשה סופית" }).click();
  await expect(s.getByText("המבחן הוגש בהצלחה")).toBeVisible();
  await expect(s.getByRole("link", { name: "סיום ויציאה מהמבחן" })).toHaveAttribute("href", "/seb/quit");
  await shot(s, "25-student-done-seb");
  await sebCtx.close();

  // The teacher sees the submission.
  await t.reload();
  await expect(t.getByText("ממתין לבדיקה", { exact: true })).toBeVisible();

  // The exam is now locked; "שכפול לגרסה חדשה" makes an editable copy with its read-aloud.
  await t.goto(examUrl);
  await expect(t.getByText("המבחן נעול לעריכה")).toBeVisible();
  await t.getByRole("button", { name: "שכפול לגרסה חדשה" }).click();
  await expect(t).not.toHaveURL(examUrl, { timeout: 20_000 });
  await expect(t.locator("#title")).toHaveValue("מלחמת העולם הראשונה (עותק)");
  await expect(t.locator("#title")).toBeEditable();
  await expect(t.getByText("המבחן נעול לעריכה")).toHaveCount(0);
  await tctx.close();
});
