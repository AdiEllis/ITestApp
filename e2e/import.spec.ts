import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Exam from a file: the teacher uploads a Word exam, the questions are read out of it, she fixes
 * them, creates the exam, makes the read-aloud for every question in one click, approves each one
 * and publishes. The student preview plays the reading of the first question.
 */

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(__dirname, ".tmp", "screens", `${name}.png`), fullPage: true });

test("a Word exam becomes questions with read-aloud", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 390, height: 844 } });
  const t = await ctx.newPage();
  await t.goto("/register");
  await t.locator("#name").fill("Import Teacher");
  await t.locator("#email").fill(`import.${Date.now()}@school.test`);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("Import School");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);

  await t.goto("/t/exams");
  await t.getByRole("link", { name: "העלאת מבחן מוכן" }).first().click();
  await expect(t).toHaveURL(/\/t\/exams\/import$/);
  await t.locator("input[type=file]").setInputFiles(path.join(__dirname, "fixtures", "history-exam.docx"));
  await expect(t.getByLabel("הועלה")).toHaveCount(1, { timeout: 20_000 });
  await t.getByRole("button", { name: "קריאת השאלות מהקובץ" }).click();

  // Review: the questions as written in the file, split into its two parts.
  await expect(t.getByText("נמצאו 5 שאלות")).toBeVisible({ timeout: 30_000 });
  await expect(t.locator("#title")).toHaveValue("מבחן בהיסטוריה - כיתה י'");
  await expect(t.getByLabel("נוסח שאלה 1").first()).toHaveValue("מה היו הגורמים לפרוץ מלחמת העולם הראשונה?");
  await expect(t.locator('[id^="pt-"]').first()).toHaveValue("20");
  await expect(t.locator('[id^="sub-"]').nth(1)).toHaveValue("מהי לאומיות?\nתנו דוגמה מאירופה במאה ה-19.");
  await expect(t.locator('[id^="st-"]')).toHaveCount(2);
  await shot(t, "30-import-review");

  // Fix one question, delete one, add one.
  await t.getByLabel("נוסח שאלה 3").first().fill("תארו את השפעת המהפכה התעשייתית על חיי הפועלים.");
  await t.getByLabel("מחיקת שאלה 2").last().click();
  await expect(t.getByText("נמצאו 4 שאלות")).toBeVisible();
  await t.getByRole("button", { name: "הוספת שאלה" }).last().click();
  await t.getByLabel("נוסח שאלה 2").last().fill("מי היה תאודור הרצל?");
  await expect(t.getByText("נמצאו 5 שאלות")).toBeVisible();
  await t.locator("#subject").fill("היסטוריה");
  await t.getByRole("button", { name: "יצירת המבחן והמשך להקראה" }).click();

  // Builder: the questions are there; one click makes the read-aloud for all of them.
  await expect(t).toHaveURL(/\/t\/exams\/\w+\?imported=1$/);
  await expect(t.getByText("המבחן נוצר מהקובץ")).toBeVisible();
  // Questions with text start folded; the speaker icon shows each one's read-aloud state.
  await expect(t.getByRole("img", { name: "אין עדיין הקראה" })).toHaveCount(5);
  const folded = t.getByRole("button", { name: /^שאלה \d/, expanded: false });
  while ((await folded.count()) > 0) await folded.first().click();
  const prompts = t.getByLabel("השאלה", { exact: true });
  await expect(prompts).toHaveCount(5);
  await expect(prompts.nth(2)).toHaveValue("תארו את השפעת המהפכה התעשייתית על חיי הפועלים.");
  await expect(prompts.nth(4)).toHaveValue("מי היה תאודור הרצל?");
  await shot(t, "31-import-builder");
  await t.getByRole("button", { name: "יצירת הקראה ל-5 השאלות" }).click();
  await expect(t.getByText("נוצרו 5 הקראות")).toBeVisible({ timeout: 60_000 });
  await expect(t.getByText("צריך להאזין ולאשר")).toHaveCount(5);
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Not approved yet: publishing is refused.
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText(/להאזין להקראה של שאלה 1 בחלק א/)).toBeVisible();
  const approve = t.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון");
  for (let i = 0; i < 5; i++) await approve.nth(i).check();
  await expect(t.getByText("ההקראה אושרה")).toHaveCount(5);
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
  await shot(t, "32-import-approved");
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText("המבחן פורסם")).toBeVisible();

  // After a reload the exam keeps its audio, and nothing is left to read.
  await t.goto(t.url().replace("?imported=1", ""));
  await expect(t.getByRole("img", { name: "ההקראה אושרה" })).toHaveCount(5);
  await expect(t.getByRole("button", { name: /יצירת הקראה ל-/ })).toHaveCount(0);
  await ctx.close();
});

test("a photo needs the Gemini service (the teacher is told what to do); a PDF is read by its text", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "he-IL" });
  const t = await ctx.newPage();
  await t.goto("/register");
  await t.locator("#name").fill("Photo Teacher");
  await t.locator("#email").fill(`photo.${Date.now()}@school.test`);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("Photo School");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);
  await t.goto("/t/exams/import");
  // A 1x1 PNG.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await t.locator("input[type=file]").setInputFiles({ name: "exam.png", mimeType: "image/png", buffer: png });
  await expect(t.getByLabel("הועלה")).toHaveCount(1, { timeout: 20_000 });
  await t.getByRole("button", { name: "קריאת השאלות מהקובץ" }).click();
  await expect(t.getByText(/העלו את המבחן כקובץ Word או PDF/)).toBeVisible({ timeout: 20_000 });

  // The same exam as a PDF is read by its text.
  await t.getByLabel("הסרה").click();
  await t.locator("input[type=file]").setInputFiles(path.join(__dirname, "fixtures", "history-exam.pdf"));
  await expect(t.getByLabel("הועלה")).toHaveCount(1, { timeout: 20_000 });
  await t.getByRole("button", { name: "קריאת השאלות מהקובץ" }).click();
  await expect(t.getByText("נמצאו 5 שאלות")).toBeVisible({ timeout: 30_000 });
  await expect(t.getByLabel("נוסח שאלה 3").first()).toHaveValue("תארו את השפעת המהפכה התעשייתית על חיי העובדים.");
  await ctx.close();
});
