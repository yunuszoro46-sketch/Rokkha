import { test, expect, type Browser, type Page } from "@playwright/test";

// Admin Control Centre in the browser. Needs the LOCAL test accounts (.env.e2e.local, made by
// Backend/scripts/seed_local_test_accounts.py). The server-side permission checks are tested in
// Backend/tests/test_api_admin_center.py; these tests check what each kind of visitor sees.
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const RESCUER = { email: process.env.E2E_RESCUER_EMAIL, password: process.env.E2E_RESCUER_PASSWORD };

async function login(browser: Browser, who: { email?: string; password?: string }, viewport = { width: 1440, height: 900 }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email!);
  await page.getByLabel("Password", { exact: true }).fill(who.password!);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("anonymous visitors see a login gate, not admin data", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Admin Control Centre" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect(page.getByText("accounts")).toHaveCount(0);
});

test.describe("with local test accounts", () => {
  test.skip(!ADMIN.email || !RESCUER.email, "local test accounts not set up");

  test("a rescuer is told the control centre is not available (and the server refuses it)", async ({ browser }) => {
    const page = await login(browser, RESCUER);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Not available for this account" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
    await page.context().close();
  });

  test("an admin moves between sections; each has its own address and real data", async ({ browser }) => {
    const page = await login(browser, ADMIN);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Requests for help" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await nav.getByRole("button", { name: "Data sources" }).click();
    await expect(page).toHaveURL(/\/admin\/data$/);
    await expect(page.getByRole("cell", { name: /Satellite flood observations/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Admin content" }).getByText(/^live$/i)).toHaveCount(0); // no source is ever called live

    await nav.getByRole("button", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await page.getByLabel("Search name or email").fill("e2e-rescuer-a");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("cell", { name: /e2e-rescuer-a@rokkha\.test/ })).toBeVisible();
    await page.getByRole("button", { name: /Open Local test rescuer/ }).first().click();
    await expect(page.getByRole("button", { name: "Suspend account" })).toBeVisible();

    await nav.getByRole("button", { name: "Audit log" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await page.context().close();
  });

  test("an announcement is published, shown publicly with its label, and withdrawn with a reason", async ({ browser }) => {
    const page = await login(browser, ADMIN);
    await page.goto("/admin/alerts");
    const title = `E2E notice ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Message").fill("Portal maintenance test. Not real.");
    await page.getByRole("button", { name: "Publish announcement" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Published: ${title}` })).toBeVisible();

    const pub = await (await browser.newContext()).newPage();
    await pub.goto("/alerts");
    const box = pub.getByRole("region", { name: "Announcements from Rokkha administrators" });
    await expect(box).toContainText(title);
    await expect(box).toContainText("Not an official warning");

    const card = page.locator("li").filter({ hasText: title });
    await card.getByRole("button", { name: "Withdraw" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Withdraw" })).toBeDisabled(); // reason required
    await dialog.getByLabel("Reason (kept in the audit log)").fill("E2E test cleanup");
    await dialog.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Announcement withdrawn." })).toBeVisible();

    await pub.reload();
    await expect(pub.getByText(title)).toHaveCount(0);

    await page.goto("/admin/audit");
    await expect(page.getByRole("cell", { name: title }).first()).toBeVisible();
    await pub.context().close();
    await page.context().close();
  });

  test("phone: the control centre has a section menu and no sideways scroll", async ({ browser }) => {
    const page = await login(browser, ADMIN, { width: 390, height: 844 });
    for (const path of ["/admin", "/admin/users", "/admin/data", "/admin/rescue", "/admin/audit", "/admin/analytics"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByLabel("Admin section", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
    await page.context().close();
  });
});
