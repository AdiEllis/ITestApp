import { expect, test } from "@playwright/test";

/** A student answers on the keyboard instead of recording; the teacher reads and grades it. */
test("typed answer: saved automatically, kept after reload, graded by the teacher", async ({ browser }) => {
  test.setTimeout(180_000);
  const tctx = await browser.newContext({ locale: "he-IL" });
  const t = await tctx.newPage();
  await t.goto("/register");
  await t.locator("#name").fill("מורה הקלדה");
  await t.locator("#email").fill(`typed.${Date.now()}@school.test`);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("תיכון");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);

  await t.goto("/t/classes");
  await t.locator("#name").fill("ט׳ 1");
  await t.getByRole("button", { name: "יצירת כיתה" }).click();
  await t.locator("#names").fill("נועה כתבן");
  await t.getByRole("button", { name: "יצירת חשבונות" }).click();
  const cells = t.locator("#credentials tbody tr").first().locator("td");
  const student = { username: (await cells.nth(1).textContent())!.trim(), password: (await cells.nth(2).textContent())!.trim() };

  await t.goto("/t/exams/new");
  await t.locator("#title").fill("מבחן בהקלדה");
  await t.locator("#subject").fill("היסטוריה");
  await t.getByRole("button", { name: "יצירה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/exams\/(?!new$)\w+$/);
  const examUrl = t.url();
  // No video fields for a regular exam.
  await t.locator("summary", { hasText: "הגדרות לשאלה" }).click();
  await expect(t.getByText("סרטון לשאלה")).toHaveCount(0);
  await t.getByLabel("השאלה", { exact: true }).fill("מה היו הגורמים למלחמה?");
  await t.getByRole("button", { name: "יצירת הקראה אוטומטית" }).click();
  await t.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון").check();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
  await t.getByRole("button", { name: "פרסום" }).click();
  await expect(t.getByText("המבחן פורסם")).toBeVisible();
  await t.goto(examUrl);
  await t.getByRole("link", { name: "שליחה לכיתה" }).click();
  await t.getByRole("button", { name: "שליחה לכיתה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/assignments\/\w+$/);

  const sctx = await browser.newContext({ locale: "he-IL", permissions: ["microphone"] });
  const s = await sctx.newPage();
  await s.goto("/login");
  await s.locator("#identifier").fill(student.username);
  await s.locator("#password").fill(student.password);
  await s.getByRole("button", { name: "התחברות" }).click();
  await s.locator("#current").fill(student.password);
  await s.locator("#password").fill("Student-pass1");
  await s.locator("#confirm").fill("Student-pass1");
  await s.getByRole("button", { name: "שמירת סיסמה" }).click();
  await expect(s).toHaveURL(/\/s$/);
  await s.getByRole("link", { name: /מבחן בהקלדה/ }).first().click();
  // A student who types doesn't need the mic check.
  await s.getByRole("button", { name: /דילוג/ }).click();
  await s.getByRole("button", { name: "התחלת המבחן" }).click();
  await expect(s).toHaveURL(/\/run$/);

  const answer = "המלחמה פרצה בגלל הלאומיות, הבריתות והמרוץ לחימוש.";
  await s.getByRole("button", { name: "תשובה בהקלדה" }).click();
  await s.getByLabel("התשובה שלך").fill(answer);
  await expect(s.getByText("התשובה נשמרה")).toBeVisible({ timeout: 10_000 });
  await expect(s.getByText("נענו 1 מתוך 1")).toBeVisible();
  // Saved on the server: a reload shows it again, in typing mode.
  await s.reload();
  await expect(s.getByLabel("התשובה שלך")).toHaveValue(answer);
  // The last edit is saved even when the student submits right away.
  await s.getByLabel("התשובה שלך").fill(`${answer} סוף.`);
  await s.getByRole("button", { name: "סיום והגשה" }).click();
  await expect(s.getByText("נשמר · תשובה בהקלדה")).toBeVisible();
  await s.getByRole("button", { name: "הגשת המבחן" }).click();
  await s.getByRole("button", { name: "הגשה סופית" }).click();
  await expect(s.getByText("המבחן הוגש בהצלחה")).toBeVisible();

  await t.goto("/t/review");
  await t.getByText("נועה כתבן").click();
  await expect(t.getByText("תשובה בהקלדה")).toBeVisible();
  await expect(t.getByText(`${answer} סוף.`)).toBeVisible();
  await t.getByLabel("ציון לשאלה").fill("90");
  await t.getByLabel("הערה לשאלה (לא חובה)").fill("תשובה טובה");
  await t.locator("#overall").fill("כל הכבוד");
  await t.getByRole("button", { name: "פרסום לתלמיד/ה" }).click();
  await expect(t.getByText("הציון והמשוב פורסמו לתלמיד/ה")).toBeVisible();

  await s.goto(s.url().replace(/\?.*$/, ""));
  await expect(s.getByText(`${answer} סוף.`)).toBeVisible();
  await expect(s.getByText("כל הכבוד")).toBeVisible();
  await tctx.close();
  await sctx.close();
});
