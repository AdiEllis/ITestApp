import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";

/**
 * End-to-end: the complete school-year loop with real recording (fake microphone),
 * real uploads to local storage, grading, feedback, the shared library and permission checks.
 */

const FIX = path.join(__dirname, ".tmp", "fixtures");
const SCREENS = path.join(__dirname, ".tmp", "screens");
const PW = "Teach3r-pass";
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: true });

const state: {
  teacherEmail: string;
  students: { name: string; username: string; password: string }[];
  examTitle: string;
  examId?: string;
  attemptId?: string;
  recordingUrl?: string;
} = { teacherEmail: `teacher.${Date.now()}@school.test`, students: [], examTitle: "Simulation A – Free time" };

let teacherCtx: BrowserContext;
let teacher: Page;

async function newCtx(browser: Browser, mobile = false) {
  return browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["microphone"], locale: "he-IL" }
      : { permissions: ["microphone"], locale: "he-IL" },
  );
}

async function registerTeacher(page: Page, name: string, email: string, school: string) {
  await page.goto("/register");
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PW);
  await page.locator("#schoolName").fill(school);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(page).toHaveURL(/\/t$/);
}

async function loginStudent(page: Page, s: { username: string; password: string }, newPassword: string) {
  await page.goto("/login");
  await page.locator("#identifier").fill(s.username);
  await page.locator("#password").fill(s.password);
  await page.getByRole("button", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/change-password/);
  await page.locator("#current").fill(s.password);
  await page.locator("#password").fill(newPassword);
  await page.locator("#confirm").fill(newPassword);
  await page.getByRole("button", { name: "שמירת סיסמה" }).click();
  await expect(page).toHaveURL(/\/s$/);
  s.password = newPassword;
}

async function recordAnswer(page: Page, seconds = 2.5) {
  await page.getByRole("button", { name: "התחלת הקלטה" }).click();
  await expect(page.getByText("מקליט", { exact: true })).toBeVisible();
  await page.waitForTimeout(seconds * 1000);
  await page.getByRole("button", { name: "סיום הקלטה" }).click();
  await expect(page.getByText("התשובה נשמרה")).toBeVisible({ timeout: 20_000 });
}

test.describe.serial("full teacher ↔ student flow", () => {
  test.beforeAll(async ({ browser }) => {
    teacherCtx = await newCtx(browser);
    teacher = await teacherCtx.newPage();
  });
  test.afterAll(async () => teacherCtx.close());

  test("1. teacher signs up and sees onboarding", async () => {
    await registerTeacher(teacher, "Dana Teacher", state.teacherEmail, "Test High School");
    await expect(teacher.getByRole("heading", { name: "צעדים ראשונים" })).toBeVisible();
    await shot(teacher, "01-teacher-onboarding");
  });

  test("2. teacher creates a class and adds students", async () => {
    await teacher.goto("/t/classes");
    await teacher.locator("#name").fill("11th grade – 5 points");
    await teacher.getByRole("button", { name: "יצירת כיתה" }).click();
    await expect(teacher).toHaveURL(/\/t\/classes\/\w+/);
    await teacher.locator("#names").fill("Noa Cohen\nYosef Levi");
    await teacher.getByRole("button", { name: "יצירת חשבונות" }).click();
    const rows = teacher.locator("#credentials tbody tr");
    await expect(rows).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const cells = rows.nth(i).locator("td");
      state.students.push({ name: (await cells.nth(0).textContent())!.trim(), username: (await cells.nth(1).textContent())!.trim(), password: (await cells.nth(2).textContent())!.trim() });
    }
    expect(state.students[0].username).toMatch(/^noa\.cohen\.[a-z0-9]{4}$/);
    await teacher.reload();
    await expect(teacher.getByRole("link", { name: "Noa Cohen", exact: true })).toBeVisible();
    await shot(teacher, "02-class");
  });

  test("3. teacher builds a COBE-structured exam, uploads the Part C video and publishes", async () => {
    await teacher.goto("/t/exams/new");
    await teacher.getByRole("button", { name: /בגרות בעל פה באנגלית/ }).click();
    await teacher.locator("#title").fill(state.examTitle);
    await teacher.getByText("תרגול", { exact: true }).click();
    await teacher.getByRole("button", { name: "יצירה", exact: true }).click();
    await expect(teacher).toHaveURL(/\/t\/exams\/(?!new$|import$)\w+$/);
    state.examId = teacher.url().split("/").pop();

    // Publishing without the Part C clip must be refused with a clear reason.
    await teacher.getByRole("button", { name: "פרסום" }).click();
    await expect(teacher.getByText("לא ניתן לפרסם עדיין")).toBeVisible();
    await expect(teacher.getByText(/Audio-Visual\) יש להעלות סרטון/)).toBeVisible();

    // Video suggestions point to the official COBE page and labelled teacher collections.
    await teacher.getByRole("button", { name: "הצעת סרטון" }).first().click();
    await expect(teacher.getByRole("link", { name: /משרד החינוך – דף ה־COBE הרשמי/ })).toBeVisible();
    await expect(teacher.getByText("אתר מורים – לא רשמי").first()).toBeVisible();

    const sectionMediaInput = teacher.locator('input[type=file][accept^="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4"]');
    await sectionMediaInput.setInputFiles(path.join(FIX, "clip.webm"));
    await expect(teacher.locator('video[src^="/api/media/"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(teacher.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
    await shot(teacher, "03-builder");

    await teacher.getByRole("button", { name: "פרסום" }).click();
    await expect(teacher.getByText("המבחן פורסם")).toBeVisible();
  });

  test("4. teacher assigns the exam to the class", async () => {
    await teacher.getByRole("link", { name: "שליחה לכיתה" }).click();
    await expect(teacher).toHaveURL(/assignments\/new/);
    await teacher.getByRole("button", { name: "שליחה לכיתה", exact: true }).click();
    await expect(teacher).toHaveURL(/\/t\/assignments\/\w+$/);
    await expect(teacher.getByText("לא התחיל/ה").first()).toBeVisible();
  });

  test("5. teacher imports a ready-made exam (PDF + audio), rejects a disguised file, maps audio to a question", async () => {
    await teacher.goto("/t/exams/import");
    await teacher.locator('input[type=file]').setInputFiles([path.join(FIX, "exam.pdf"), path.join(FIX, "question.mp3"), path.join(FIX, "fake.pdf")]);
    await expect(teacher.getByText("תוכן הקובץ אינו תואם את סוג הקובץ")).toBeVisible({ timeout: 20_000 });
    await expect(teacher.getByLabel("הועלה")).toHaveCount(2);
    await teacher.locator("#title").fill("Imported practice");
    // This PDF has no questions to read, so the teacher types them in the builder.
    await teacher.getByRole("button", { name: "דילוג: אקליד את השאלות בעצמי בעורך" }).click();
    await expect(teacher).toHaveURL(/\/t\/exams\/(?!new$|import$)\w+$/);
    await expect(teacher.getByText("exam.pdf").first()).toBeVisible();
    await teacher.getByRole("button", { name: "הוספת שאלה" }).click();
    await teacher.getByLabel("השאלה", { exact: true }).fill("Listen to the recording and describe what you hear.");
    // The uploaded audio becomes the question's reading, which must be approved before publishing.
    await teacher.locator("select").filter({ hasText: "מהקבצים שהועלו" }).first().selectOption({ label: "question.mp3" });
    await expect(teacher.locator('audio[src^="/api/media/"]').first()).toBeVisible();
    await expect(teacher.getByText("צריך להאזין ולאשר")).toBeVisible();
    await teacher.getByLabel("האזנתי להקראה עד הסוף, והיא קוראת את השאלה נכון").check();
    await expect(teacher.getByText("ההקראה אושרה")).toBeVisible();
    // Videos are only for the English oral bagrut, so a regular exam doesn't offer them.
    await teacher.getByText("הגדרות לשאלה").last().click();
    await expect(teacher.getByLabel("סרטון לשאלה (קישור, לא חובה)")).toHaveCount(0);
    await expect(teacher.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 15_000 });
    await teacher.getByRole("button", { name: "פרסום" }).click();
    await expect(teacher.getByText("המבחן פורסם")).toBeVisible();
  });

  test("6. student logs in, changes the temporary password, checks the mic, records every answer and submits", async ({ browser }) => {
    const ctx = await newCtx(browser, true);
    const page = await ctx.newPage();
    const s = state.students[0];
    await loginStudent(page, s, "Student-pass1");
    await expect(page.getByText(state.examTitle)).toBeVisible();
    // Exams the student hasn't started are marked new, with a count on the tab.
    await expect(page.getByText("חדש", { exact: true }).first()).toBeVisible();
    await expect(page.locator('[aria-label$="מבחנים חדשים"]:visible')).toHaveText("1");
    await shot(page, "06-student-home-mobile");
    await page.getByText(state.examTitle).click();

    // Mic check: real recording from the (fake) microphone, then playback.
    await page.getByRole("button", { name: "הפעלת מיקרופון" }).click();
    await page.getByRole("button", { name: /הקלטת ניסיון/ }).click();
    await expect(page.getByRole("button", { name: "שמעתי את עצמי — הכול תקין" })).toBeVisible({ timeout: 15_000 });
    const testAudioDuration = await page.locator("audio").first().evaluate(async (a: HTMLAudioElement) => {
      if (a.readyState < 1) await new Promise((r) => a.addEventListener("loadedmetadata", r, { once: true }));
      return a.duration;
    });
    expect(testAudioDuration === Infinity || testAudioDuration > 1).toBeTruthy();
    await page.getByRole("button", { name: "שמעתי את עצמי — הכול תקין" }).click();
    await page.getByRole("button", { name: "התחלת המבחן" }).click();
    await expect(page).toHaveURL(/\/run$/);
    state.attemptId = page.url().split("/").at(-2);

    // Part A: choose a topic, then record.
    await page.getByRole("button", { name: /spend your free time/ }).click();
    await shot(page, "06b-runner-question-mobile");
    await recordAnswer(page);
    await shot(page, "06c-runner-saved-mobile");
    await page.getByRole("button", { name: "הבא" }).click();
    // Part B
    await recordAnswer(page);
    await page.getByRole("button", { name: "הבא" }).click();
    // Part C – the clip must actually load (served with Range support).
    const video = page.locator("video").first();
    await expect(video).toBeVisible();
    const ready = await video.evaluate(async (v: HTMLVideoElement) => {
      if (v.readyState < 1) await new Promise((r) => v.addEventListener("loadedmetadata", r, { once: true }));
      return v.duration;
    });
    expect(ready).toBeGreaterThan(3);
    await recordAnswer(page);
    await page.getByRole("button", { name: "הבא" }).click();
    await recordAnswer(page);
    await page.getByRole("button", { name: "סיום והגשה" }).click();
    await expect(page.getByRole("heading", { name: "סיום והגשה" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "נשמר" })).toHaveCount(4);
    await page.getByRole("button", { name: "הגשת המבחן" }).click();
    await page.getByRole("button", { name: "הגשה סופית" }).click();
    await expect(page.getByText("המבחן הוגש בהצלחה")).toBeVisible();
    await expect(page.getByText("ממתין לבדיקה")).toBeVisible();

    // A second submit is a no-op.
    const again = await page.request.post(`/api/attempts/${state.attemptId}/submit`, { headers: { origin: "http://localhost:3100" } });
    expect((await again.json()).alreadySubmitted).toBe(true);
    // The run page now redirects to the result instead of allowing more recording.
    await page.goto(`/s/attempts/${state.attemptId}/run`);
    await expect(page).toHaveURL(new RegExp(`/s/attempts/${state.attemptId}$`));
    await ctx.close();
  });

  test("7. teacher listens to the recordings, grades each question and publishes feedback", async () => {
    await teacher.goto("/t/review");
    await teacher.getByText(state.students[0].name).click();
    await expect(teacher).toHaveURL(/\/t\/review\/\w+/);

    // A stale link (phone back from another app) fails once; the player loads a fresh one by itself.
    let failed = 0;
    await expect(teacher.locator('audio[src^="/api/media/"]').first()).toBeAttached();
    await teacher.route("**/api/media/**", (route) => (failed++ === 0 ? route.fulfill({ status: 403, body: "expired" }) : route.continue()));
    await teacher.locator("audio").first().evaluate((a: HTMLAudioElement) => a.load());
    await expect(teacher.locator('audio[src*="r="]').first()).toBeAttached({ timeout: 10_000 });
    await expect.poll(() => teacher.locator("audio").first().evaluate((a: HTMLAudioElement) => a.readyState), { timeout: 10_000 }).toBeGreaterThan(0);
    await teacher.unroute("**/api/media/**");

    const src = await teacher.locator('audio[src^="/api/media/"]').first().getAttribute("src");
    state.recordingUrl = src!;
    const res = await teacher.request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^audio\//);
    expect((await res.body()).length).toBeGreaterThan(2000);
    const duration = await teacher.locator("audio").first().evaluate(async (a: HTMLAudioElement) => {
      if (a.readyState < 1) await new Promise((r) => a.addEventListener("loadedmetadata", r, { once: true }));
      return a.duration;
    });
    expect(duration === Infinity || duration > 1).toBeTruthy();

    const nav = teacher.getByRole("navigation", { name: "שאלות" }).getByRole("button");
    await expect(nav).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await nav.nth(i).click();
      await teacher.getByLabel("ציון לשאלה").fill("100"); // capped at the question's points
      await teacher.getByLabel("הערה לשאלה (לא חובה)").fill(`Good answer ${i + 1}.`);
    }
    // The final grade starts as the sum of the question scores; the teacher may change it.
    await expect(teacher.locator("#final")).toHaveValue("100");
    await teacher.locator("#final").fill("88");
    await expect(teacher.getByRole("button", { name: /חזרה לסכום השאלות/ })).toBeVisible();
    await teacher.locator("#overall").fill("Great fluency. Add more examples.");
    await shot(teacher, "07-grader");
    await teacher.getByRole("button", { name: "פרסום לתלמיד/ה" }).click();
    await expect(teacher.getByText("הציון והמשוב פורסמו לתלמיד/ה")).toBeVisible();
    await expect(teacher.getByText("88", { exact: true })).toBeVisible();
  });

  test("8. student sees the published grade and feedback", async ({ browser }) => {
    const ctx = await newCtx(browser, true);
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#identifier").fill(state.students[0].username);
    await page.locator("#password").fill(state.students[0].password);
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page.getByText("משוב חדש")).toBeVisible();
    await page.goto(`/s/attempts/${state.attemptId}`);
    await expect(page.getByText("88", { exact: true })).toBeVisible();
    await expect(page.getByText("Great fluency. Add more examples.")).toBeVisible();
    await expect(page.getByText("Good answer 1.")).toBeVisible();
    await shot(page, "08-student-result-mobile");
    await page.goto("/s/history");
    await expect(page.getByText(state.examTitle)).toBeVisible();
    await ctx.close();
  });

  test("9. teacher shares to the library; another teacher copies it into their own exams", async ({ browser }) => {
    await teacher.goto(`/t/exams/${state.examId}`);
    await expect(teacher.getByText("המבחן נעול לעריכה")).toBeVisible(); // attempts exist → locked
    await teacher.getByRole("button", { name: "שיתוף במאגר המשותף" }).click();
    const share = teacher.getByRole("button", { name: "שיתוף", exact: true });
    await expect(share).toBeDisabled();
    await teacher.getByRole("checkbox", { name: /יש לי זכות לשתף/ }).check();
    await share.click();
    await expect(teacher.getByText("המבחן שותף במאגר")).toBeVisible();

    const ctx = await newCtx(browser);
    const t2 = await ctx.newPage();
    await registerTeacher(t2, "Other Teacher", `other.${Date.now()}@school.test`, "Other School");
    await t2.goto("/t/library");
    await t2.getByText(state.examTitle).click();
    await expect(t2.getByText("Part C – Audio-Visual Prompt")).toBeVisible();
    await t2.getByRole("button", { name: "העתקה למבחנים שלי" }).click();
    await expect(t2.getByText("המבחן הועתק לספרייה שלך")).toBeVisible();
    await expect(t2.getByText("טיוטה", { exact: true })).toBeVisible();

    // Isolation: the other teacher cannot reach the first teacher's private data.
    expect((await t2.request.get(state.recordingUrl!)).status()).toBe(404);
    await t2.goto(`/t/review/${state.attemptId}`);
    await expect(t2.getByText("הדף לא נמצא")).toBeVisible();
    await t2.goto(`/t/exams/${state.examId}`);
    await expect(t2.getByText("הדף לא נמצא")).toBeVisible();
    await ctx.close();
  });

  test("10. permissions: second student cannot see the first student's work; students cannot open teacher pages", async ({ browser, request }) => {
    expect((await request.get(state.recordingUrl!)).status()).toBe(401);
    const ctx = await newCtx(browser);
    const page = await ctx.newPage();
    await loginStudent(page, state.students[1], "Student-pass2");
    await page.goto("/t");
    await expect(page).toHaveURL(/\/s$/);
    await page.goto(`/s/attempts/${state.attemptId}`);
    await expect(page.getByText("הדף לא נמצא")).toBeVisible();
    expect((await page.request.get(state.recordingUrl!)).status()).toBe(404);
    const forged = await page.request.post("/api/uploads", {
      data: { kind: "QUESTION_VIDEO", mimeType: "video/mp4", sizeBytes: 1000 },
      headers: { origin: "http://localhost:3100" },
    });
    expect(forged.status()).toBe(403);
    const crossSite = await page.request.post(`/api/attempts/${state.attemptId}/submit`, { headers: { origin: "https://evil.example" } });
    expect(crossSite.status()).toBe(403);

    // Microphone permission denied → clear, actionable message.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.goto("/s/mic-check");
    await page.getByRole("button", { name: "הפעלת מיקרופון" }).click();
    await expect(page.getByText("הגישה למיקרופון נחסמה")).toBeVisible();
    await shot(page, "10-mic-denied");
    await ctx.close();
  });

  test("11. offline during upload: the recording is kept locally and uploaded when the connection returns", async ({ browser }) => {
    const ctx = await newCtx(browser, true);
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#identifier").fill(state.students[1].username);
    await page.locator("#password").fill(state.students[1].password);
    await page.getByRole("button", { name: "התחברות" }).click();
    await page.getByText(state.examTitle).click();
    await page.getByRole("button", { name: /דילוג/ }).click();
    await page.getByRole("button", { name: "התחלת המבחן" }).click();
    await expect(page).toHaveURL(/\/run$/);
    await page.getByRole("button", { name: /learning outside the classroom/ }).click();
    await page.getByRole("button", { name: "התחלת הקלטה" }).click();
    await page.waitForTimeout(2000);
    await ctx.setOffline(true);
    await page.getByRole("button", { name: "סיום הקלטה" }).click();
    await expect(page.getByText("ההקלטה שמורה במכשיר וממתינה לחיבור לאינטרנט")).toBeVisible();
    await expect(page.getByText("אין חיבור לאינטרנט")).toBeVisible();
    await shot(page, "11-offline-mobile");
    await ctx.setOffline(false);
    await expect(page.getByText("התשובה נשמרה")).toBeVisible({ timeout: 30_000 });

    // Reload: the saved answer is restored from the server.
    await page.reload();
    await expect(page.getByText("התשובה נשמרה")).toBeVisible();
    await ctx.close();
  });

  test("12. teacher dashboard reflects submissions", async () => {
    await teacher.goto("/t");
    await expect(teacher.getByText("ממתינות לבדיקה", { exact: true })).toBeVisible();
    await shot(teacher, "12-dashboard");
  });
});
