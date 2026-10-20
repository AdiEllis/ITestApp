import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_e2e?schema=public";

test("admin: forced password change, schools & retention, users, audit log; non-admins are kept out", async ({ page, browser }) => {
  const email = `admin.${Date.now()}@school.test`;
  const out = execFileSync("npx", ["tsx", "scripts/create-admin.ts", email, "Admin Person"], { env: { ...process.env, DATABASE_URL: DB } }).toString();
  const temp = out.match(/Temporary password: (\S+)/)![1];

  await page.goto("/login");
  await page.locator("#identifier").fill(email);
  await page.locator("#password").fill(temp);
  await page.getByRole("button", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/change-password/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/change-password/); // cannot skip the forced change
  await page.locator("#current").fill(temp);
  await page.locator("#password").fill("Admin-pass1");
  await page.locator("#confirm").fill("Admin-pass1");
  await page.getByRole("button", { name: "שמירת סיסמה" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByPlaceholder("שם בית ספר חדש").fill("Admin Created School");
  await page.getByRole("button", { name: "יצירה" }).click();
  await expect(page.getByText(/קוד הצטרפות למורים/)).toBeVisible();
  const row = page.locator("tr").filter({ hasText: "Admin Created School" });
  await row.getByLabel("ימי שמירה").fill("180");
  await row.getByRole("button", { name: "שמירה" }).click();
  await expect(row.getByText("נשמר")).toBeVisible();
  await page.screenshot({ path: path.join(__dirname, ".tmp", "screens", "20-admin.png"), fullPage: true });

  await page.goto("/admin/users");
  await page.getByLabel("שם", { exact: true }).fill("New Staff Teacher");
  await page.getByLabel("דוא״ל").fill(`staff.${Date.now()}@school.test`);
  await page.getByLabel("בית ספר").selectOption({ label: "Admin Created School" });
  await page.getByRole("button", { name: "יצירה" }).click();
  await expect(page.getByText("סיסמה זמנית (מוצגת פעם אחת)")).toBeVisible();

  await page.goto("/admin/audit?action=admin.");
  await expect(page.getByText("admin.school_create")).toBeVisible();
  await expect(page.getByText("admin.retention_update")).toBeVisible();
  await expect(page.getByText("admin.user_create")).toBeVisible();

  // A teacher cannot open the admin area.
  const ctx = await browser.newContext();
  const t = await ctx.newPage();
  await t.goto("/register");
  await t.locator("#name").fill("Plain Teacher");
  await t.locator("#email").fill(`plain.${Date.now()}@school.test`);
  await t.locator("#password").fill("Teach3r-pass");
  await t.locator("#schoolName").fill("Plain School");
  await t.getByRole("checkbox").check();
  await t.getByRole("button", { name: "יצירת חשבון" }).click();
  await expect(t).toHaveURL(/\/t$/);
  await t.goto("/admin/users");
  await expect(t).toHaveURL(/\/t$/);
  await ctx.close();
});
