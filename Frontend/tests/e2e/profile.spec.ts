import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

// The navbar account menu: identity from the session only, items by role, logout, and a suspension
// that ends the session in an already open page. Local test database and accounts only.
const API = process.env.E2E_API_URL || "http://localhost:8001/api/v1";
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const RESCUER = { email: process.env.E2E_RESCUER_EMAIL, password: process.env.E2E_RESCUER_PASSWORD };
test.skip(!ADMIN.email || !RESCUER.email, "local test accounts not set up");

async function login(browser: Browser, email: string, password: string, width = 1440): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

const menuButton = (page: Page) => page.getByRole("button", { name: /^Account: / });

test("admin: the account menu shows the real name and role and the admin workspace", async ({ browser }) => {
  const page = await login(browser, ADMIN.email!, ADMIN.password!);
  await page.goto("/");
  await expect(menuButton(page)).toHaveAccessibleName("Account: Local test admin, Admin");
  await menuButton(page).click();
  const panel = page.locator(`#${await menuButton(page).getAttribute("aria-controls")}`.replace(/:/g, "\\:"));
  await expect(panel).toContainText(ADMIN.email!);
  await expect(panel.getByRole("button", { name: "Admin Control Centre" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Rescue board" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await menuButton(page).click();
  await page.getByRole("button", { name: "Admin Control Centre" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().close();
});

test("rescuer: team shown, no admin workspace; logout returns to a guest navbar", async ({ browser }) => {
  const page = await login(browser, RESCUER.email!, RESCUER.password!);
  await page.goto("/");
  await expect(menuButton(page)).toHaveAccessibleName(/Rescuer$/);
  await menuButton(page).click();
  await expect(page.getByText(/Rescuer · Local Test Team A/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin Control Centre" })).toHaveCount(0);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(menuButton(page)).toHaveCount(0);
  await page.context().close();
});

test("a citizen account suspended by an admin is logged out of an open page on its next request", async ({ browser, request }) => {
  const email = `e2e-citizen-${randomUUID().slice(0, 8)}@rokkha.test`;
  const password = `pw-${randomUUID()}`;
  const made = await request.post(`${API}/auth/register`, { data: { name: "E2E Citizen", email, password } });
  expect(made.status()).toBe(201);
  const userId = (await made.json()).user.id;

  const page = await login(browser, email, password);
  await page.goto("/");
  await expect(menuButton(page)).toHaveAccessibleName("Account: E2E Citizen, User");
  await menuButton(page).click();
  await expect(page.getByRole("button", { name: "Rescue board" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const admin = (await (await request.post(`${API}/auth/login`, { data: ADMIN })).json()).token;
  const suspended = await request.patch(`${API}/admin/users/${userId}/status`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: { status: "suspended", reason: "E2E: suspension ends the session" },
  });
  expect(suspended.ok()).toBeTruthy();

  // Any request the page makes now is refused; the navbar must stop showing the account.
  await menuButton(page).click();
  await page.getByRole("button", { name: "My place and flood report" }).click();
  await expect(menuButton(page)).toHaveCount(0, { timeout: 15_000 });
  await page.goto("/");
  await expect(menuButton(page)).toHaveCount(0);
  await page.context().close();
});
