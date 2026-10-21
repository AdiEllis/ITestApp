import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const TMP = path.join(path.dirname(new URL(import.meta.url).pathname), ".tmp");
fs.mkdirSync(TMP, { recursive: true });
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(TMP, `${n}.png`), fullPage: true });

let teacherCtx: BrowserContext;
let teacher: Page;
let studentLink = "";
let submissionPath = "";
let feedback = "";

test.describe.serial("no-server flow: link → record → file → import → grade → feedback", () => {
  test.beforeAll(async ({ browser }) => {
    teacherCtx = await browser.newContext({ permissions: ["microphone"], acceptDownloads: true });
    teacher = await teacherCtx.newPage();
  });
  test.afterAll(() => teacherCtx.close());

  test("teacher creates a COBE exam and a class link", async () => {
    await teacher.goto("#/t");
    await expect(teacher.getByText("ברוכה הבאה")).toBeVisible();
    await teacher.getByRole("link", { name: "מבחן חדש" }).click();
    await teacher.locator("#title").fill("Practice A – Free time");
    await teacher.locator("#mode").selectOption("PRACTICE");
    await teacher.getByRole("button", { name: "יצירה והמשך לעריכה" }).click();
    await expect(teacher.getByText("לפני שליחה יש לתקן")).toBeVisible(); // Part C needs a video
    await teacher.locator('input[id^="v-"]').fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await expect(teacher.getByText("לפני שליחה יש לתקן")).toHaveCount(0);
    await expect(teacher.getByText("נשמר", { exact: true })).toBeVisible();
    await teacher.locator("#cls").fill("י״א 3");
    await teacher.locator("#teacher").fill("המורה דנה");
    await teacher.getByRole("button", { name: "יצירת קישור" }).click();
    studentLink = (await teacher.getByRole("link", { name: "פתיחה כתלמיד" }).getAttribute("href"))!;
    expect(studentLink).toContain("#/x/");
    await shot(teacher, "lite-01-builder");
    // Survives a reload (saved in the browser).
    await teacher.reload();
    await expect(teacher.locator("#title")).toHaveValue("Practice A – Free time");
  });

  test("student opens the link on a phone, records, survives reload, goes offline, finishes and gets a file", async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    const s = await ctx.newPage();
    await s.goto(studentLink);
    await expect(s.getByText("Practice A – Free time")).toBeVisible();
    await expect(s.getByText("י״א 3")).toBeVisible();
    await s.locator("#sname").fill("נועה כהן");
    await s.getByRole("button", { name: "הפעלת מיקרופון" }).click();
    await s.getByRole("button", { name: /הקלטת ניסיון/ }).click();
    await s.getByRole("button", { name: "שמעתי את עצמי — הכול תקין" }).click({ timeout: 15_000 });
    await s.getByRole("button", { name: "התחלה" }).click();

    const record = async () => {
      await s.getByRole("button", { name: "התחלת הקלטה" }).click();
      await expect(s.getByText("מקליט", { exact: true })).toBeVisible();
      await s.waitForTimeout(2200);
      await s.getByRole("button", { name: "סיום הקלטה" }).click();
      await expect(s.getByText("התשובה נשמרה במכשיר")).toBeVisible();
    };
    await s.getByRole("button", { name: /spend your free time/ }).click();
    await record();
    await shot(s, "lite-02-student-saved");
    // Reload mid-exam: answer and position are kept on the device.
    await s.reload();
    await expect(s.getByText("התשובה נשמרה במכשיר")).toBeVisible();
    await s.getByRole("button", { name: "הבא" }).click();
    // No network needed during the exam.
    await ctx.setOffline(true);
    await record();
    await s.getByRole("button", { name: "הבא" }).click();
    await record();
    await s.getByRole("button", { name: "הבא" }).click();
    await record();
    await s.getByRole("button", { name: "סיום" }).click();
    await expect(s.locator("li").filter({ hasText: "הוקלט" })).toHaveCount(4);
    await s.getByRole("button", { name: "סיום המבחן" }).click();
    await s.getByRole("button", { name: "סיום והכנת קובץ למורה" }).click();
    await expect(s.getByText("סיימת! עכשיו שולחים למורה")).toBeVisible();
    await ctx.setOffline(false);
    const dl = s.waitForEvent("download");
    await s.getByRole("button", { name: "שליחת ההגשה למורה" }).click();
    const d = await dl;
    expect(d.suggestedFilename()).toBe("נועה כהן - Practice A – Free time.html");
    submissionPath = path.join(TMP, "submission.html");
    await d.saveAs(submissionPath);
    await expect(s.getByText("הקובץ נשמר בהורדות")).toBeVisible();
    await shot(s, "lite-03-student-send");
    expect(fs.statSync(submissionPath).size).toBeGreaterThan(8000);
    await ctx.close();
  });

  test("the submission file itself is playable when opened directly", async ({ page }) => {
    await page.goto("file://" + submissionPath);
    await expect(page.locator("audio")).toHaveCount(4);
    const dur = await page.locator("audio").first().evaluate(async (a: HTMLAudioElement) => {
      if (a.readyState < 1) await new Promise((r) => a.addEventListener("loadedmetadata", r, { once: true }));
      return a.duration;
    });
    expect(dur === Infinity || dur > 1).toBeTruthy();
  });

  test("teacher imports (rejecting a wrong file), listens, grades and creates a feedback link", async () => {
    const bad = path.join(TMP, "not-a-submission.html");
    fs.writeFileSync(bad, "<html><body>hello</body></html>");
    await teacher.goto("#/t/inbox");
    await teacher.locator('input[type=file]').setInputFiles([submissionPath, bad]);
    await expect(teacher.getByText("יובאו 1 הגשות")).toBeVisible();
    await expect(teacher.getByText("הקובץ אינו קובץ הגשה של OralPrep")).toBeVisible();
    // Importing the same file again does not duplicate it.
    await teacher.locator('input[type=file]').setInputFiles([submissionPath]);
    await expect(teacher.getByText("(עודכן)")).toBeVisible();
    await expect(teacher.locator("li").filter({ hasText: "נועה כהן" })).toHaveCount(1);

    await teacher.getByRole("link", { name: /נועה כהן/ }).click();
    const dur = await teacher.locator("audio").first().evaluate(async (a: HTMLAudioElement) => {
      if (a.readyState < 1) await new Promise((r) => a.addEventListener("loadedmetadata", r, { once: true }));
      return a.duration;
    });
    expect(dur === Infinity || dur > 1).toBeTruthy();
    const nav = teacher.getByRole("navigation", { name: "שאלות" }).getByRole("button");
    await expect(nav).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await nav.nth(i).click();
      const bands = teacher.getByRole("button", { name: /^מצוין/ });
      for (let b = 0; b < 4; b++) await bands.nth(b).click();
      await teacher.getByLabel("משוב לשאלה").fill(`Good answer ${i + 1}.`);
    }
    await teacher.locator("#overall").fill("Great fluency. Add more examples.");
    await teacher.getByRole("button", { name: "סיום בדיקה" }).click();
    await expect(teacher.getByText("הבדיקה הושלמה")).toBeVisible();
    await expect(teacher.getByText("88", { exact: true })).toBeVisible();
    await shot(teacher, "lite-04-grader");
    feedback = (await teacher.getByRole("link", { name: "וואטסאפ" }).getAttribute("href"))!;
    feedback = decodeURIComponent(feedback.split("text=")[1]).split("\n")[1];
    expect(feedback).toContain("#/f/");
  });

  test("student opens the feedback link", async ({ page }) => {
    await page.goto(feedback);
    await expect(page.getByText("משוב עבור נועה כהן")).toBeVisible();
    await expect(page.getByText("88", { exact: true })).toBeVisible();
    await expect(page.getByText("Great fluency. Add more examples.")).toBeVisible();
    await expect(page.getByText("Good answer 2.")).toBeVisible();
    await shot(page, "lite-05-feedback");
  });

  test("progress, CSV export, backup → wipe → restore", async () => {
    await teacher.goto("#/t/students");
    await expect(teacher.getByRole("link", { name: "נועה כהן" })).toBeVisible();
    const csv = teacher.waitForEvent("download");
    await teacher.getByRole("button", { name: "ייצוא ציונים לאקסל" }).click();
    const csvText = fs.readFileSync(await (await csv).path(), "utf8");
    expect(csvText).toContain("נועה כהן");
    expect(csvText).toContain("88");

    await teacher.goto("#/t/settings");
    const b = teacher.waitForEvent("download");
    await teacher.getByRole("button", { name: "שמירת גיבוי" }).click();
    const backupPath = path.join(TMP, "backup.json");
    await (await b).saveAs(backupPath);
    teacher.once("dialog", (d) => d.accept());
    await teacher.getByRole("button", { name: "מחיקת כל הנתונים" }).click();
    await teacher.goto("#/t/inbox");
    await expect(teacher.getByText("עדיין אין הגשות")).toBeVisible();
    await teacher.goto("#/t/settings");
    await teacher.locator('input[type=file]').setInputFiles(backupPath);
    await expect(teacher.getByText("שוחזרו 1 מבחנים ו־1 הגשות")).toBeVisible();
    await teacher.goto("#/t/inbox");
    await expect(teacher.getByText("נועה כהן")).toBeVisible();
    await expect(teacher.getByText("88", { exact: true })).toBeVisible();
    await teacher.goto("#/t");
    await shot(teacher, "lite-06-dashboard");
  });
});
