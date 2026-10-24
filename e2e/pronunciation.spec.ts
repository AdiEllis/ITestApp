import { expect, test } from "@playwright/test";

/**
 * The teacher's pronunciation dictionary, and a long reading passage read in parts: a word added to
 * the dictionary is fixed in the read-aloud, the passage becomes one playable MP3, and the
 * dictionary stays for the next exams.
 */
test("pronunciation dictionary and a long reading passage", async ({ page: t }) => {
  test.setTimeout(180_000);
  await t.goto("/register");
  await t.locator("#name").fill("מורה מילון");
  await t.locator("#email").fill(`dict.${Date.now()}@school.test`);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("תיכון");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);

  await t.goto("/t/exams/new");
  await t.locator("#title").fill("הבנת הנקרא");
  await t.locator("#subject").fill("עברית");
  await t.getByRole("button", { name: "יצירה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/exams\/(?!new$)\w+$/);

  // A reading passage longer than one request to the voice service.
  const passage = Array.from({ length: 100 }, (_, i) => `בפסקה ${i + 1} הילד קרא ספר מעניין בספרייה, ומספר החברים שלו גדל.`).join(" ");
  const question = `קראו את הקטע וענו על השאלה.\n${passage}\nמה למד הילד מהספר?`;
  expect(question.length).toBeGreaterThan(5000);
  await t.getByLabel("השאלה", { exact: true }).fill(question);
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Add a word to the dictionary.
  await t.getByRole("button", { name: /מילון הגייה/ }).click();
  await t.getByLabel("המילה כפי שהיא כתובה").fill("ספר");
  await t.getByLabel("איך להקריא אותה").fill("ספר");
  await t.getByRole("button", { name: "הוספה למילון" }).click();
  await expect(t.getByText("ההקראה זהה למילה")).toBeVisible();
  await t.getByLabel("איך להקריא אותה").fill("סֵפֶר");
  await t.getByRole("button", { name: "הוספה למילון" }).click();
  await expect(t.getByRole("list", { name: "המילים במילון" }).getByText("סֵפֶר")).toBeVisible();
  // "ספר" appears on its own; "בספרייה", "ומספר" and "מהספר" are other words and stay as they are.
  await expect(t.getByText("בשאלה הזאת יתוקנו: ספר")).toBeVisible();

  await t.getByRole("button", { name: "יצירת הקראה אוטומטית" }).click();
  await expect(t.getByText("צריך להאזין ולאשר")).toBeVisible({ timeout: 60_000 });
  await expect(t.getByText("לפי המילון תוקנו: ספר")).toBeVisible();
  const audio = t.locator('audio[src^="/api/media/"]').first();
  const src = (await audio.getAttribute("src"))!;
  const res = await t.request.get(src);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("audio/mpeg");
  const body = await res.body();
  // MPEG audio frame sync; one file for the whole passage.
  expect(body[0]).toBe(0xff);
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => (a.error ? -a.error.code : a.readyState)), { timeout: 15_000 }).toBeGreaterThan(0);
  const duration = await audio.evaluate((a: HTMLAudioElement) => a.duration);
  // The test voice gives up to 5 s per part, and the passage is several parts.
  expect(duration).toBeGreaterThan(8);

  await t.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון").check();
  await expect(t.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });

  // The dictionary stays: a new exam shows it, and a word can be removed.
  await t.goto("/t/exams/new");
  await t.locator("#title").fill("מבחן שני");
  await t.getByRole("button", { name: "יצירה", exact: true }).click();
  await expect(t).toHaveURL(/\/t\/exams\/(?!new$)\w+$/);
  await t.getByLabel("השאלה", { exact: true }).fill("איזה ספר קראת?");
  await t.getByRole("button", { name: "מילון הגייה (1)" }).click();
  await expect(t.getByText("בשאלה הזאת יתוקנו: ספר")).toBeVisible();
  await t.getByRole("button", { name: "מחיקת ספר מהמילון" }).click();
  await expect(t.getByRole("list", { name: "המילים במילון" })).toHaveCount(0);
  await t.reload();
  await expect(t.getByRole("button", { name: "הקול הוגה מילה לא נכון? מילון הגייה" })).toBeVisible();
});
