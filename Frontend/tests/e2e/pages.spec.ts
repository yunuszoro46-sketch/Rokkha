import { test, expect, type Page } from "@playwright/test";

// The rest of the portal still works around the map.

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
  await page.goto(path);
}

test("homepage: hero and the main buttons lead somewhere real", async ({ page }) => {
  await open(page, "/");
  await expect(page.locator("main h1")).toHaveText("See the risk before the water rises.");
  await page.locator("main").getByRole("button", { name: "Explore flood intelligence" }).first().click();
  await expect(page).toHaveURL(/\/map$/);
});

test("help request form opens from the homepage with no account", async ({ page }) => {
  await open(page, "/");
  await page.locator("main").getByRole("button", { name: "Request assistance" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Ask for emergency help" });
  await expect(dialog).toBeVisible();
  // Keyboard: focus starts inside the dialog and Escape closes it.
  await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("alerts, contacts and shelters pages render", async ({ page }) => {
  await open(page, "/alerts");
  await expect(page.getByRole("heading", { level: 1, name: "District flood warnings" })).toBeVisible();
  await open(page, "/contacts");
  await expect(page.getByRole("heading", { name: /Rescue and relief contacts/ })).toBeVisible();
  await open(page, "/shelters");
  await expect(page.getByRole("heading", { name: /Nearest emergency shelters/ })).toBeVisible();
});

test("alerts: the forecast day can be changed on the page and warning cards are buttons", async ({ page }) => {
  await open(page, "/alerts");
  const day = page.getByRole("group", { name: "Forecast day" });
  await expect(day).toContainText("today");
  await day.getByRole("button", { name: "Previous day" }).click();
  await expect(day).not.toContainText("today");
  await expect(day.getByRole("button", { name: "Next day" })).toBeEnabled();
  // Whatever the stored data holds, the page states it: warning cards (as buttons), "none reached", or "no forecast".
  const cards = page.locator("main button").filter({ hasText: "Model flood probability" });
  await expect
    .poll(async () => (await cards.count()) > 0 || (await page.getByRole("status").filter({ hasText: /No district reached|No forecast for/ }).count()) > 0)
    .toBe(true);
});

test("shelters: a failed request says so instead of showing an empty list", async ({ page }) => {
  await page.route("**/assets/near**", (route) => route.abort());
  await open(page, "/shelters");
  const err = page.getByRole("alert").filter({ hasText: "could not be loaded" });
  await expect(err).toBeVisible();
  await expect(err).toContainText("does not mean there are no shelters nearby");
  await page.unroute("**/assets/near**");
  await err.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: /Open on OpenStreetMap/ }).first()).toBeVisible();
});

test("login form has labelled fields", async ({ page }) => {
  await open(page, "/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

// Needs a rescuer account in the TEST database; credentials come from the environment, never the repo.
test("rescue board loads for a rescuer", async ({ page }) => {
  const email = process.env.E2E_RESCUER_EMAIL;
  const password = process.env.E2E_RESCUER_PASSWORD;
  test.skip(!email || !password, "set E2E_RESCUER_EMAIL and E2E_RESCUER_PASSWORD for a test-database rescuer");
  await open(page, "/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/rescue$/);
  await expect(page.getByRole("heading", { name: "Rescue board", exact: true })).toBeVisible();
});

test("alerts on a quiet day: forecast status, coverage, official sources and next steps, never 'safe'", async ({ page }) => {
  await open(page, "/alerts");
  const ctx = page.getByRole("region", { name: "About this forecast" });
  await expect(ctx).toBeVisible();
  await expect(ctx.getByRole("heading", { name: "Official warnings" })).toBeVisible();
  await expect(ctx.getByRole("link", { name: /ffwc\.gov\.bd/ })).toHaveAttribute("href", "https://www.ffwc.gov.bd/");
  await expect(ctx).toContainText("No Watch or Alert does not mean safe.");
  await page.getByRole("group", { name: "Forecast day" }).getByRole("button", { name: "Previous day" }).click();
  // A stored day states when it was issued and how many districts it covers (from the real records).
  await expect.poll(async () => (await ctx.innerText()).match(/Forecast issued|No forecast stored/) !== null).toBe(true);
  await expect(page.locator("main")).not.toContainText(/all safe|no risk today/i);
});

test("shelters: missing capacity and source are stated, never filled in", async ({ page }) => {
  await open(page, "/shelters");
  const first = page.locator("main h2").first();
  await expect(first).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).toMatch(/Capacity not recorded|\(not verified\)/);
  expect(text).toMatch(/Source: OpenStreetMap, not checked on the ground|Added by hand; source not recorded/);
  expect(text).toContain("whether it is open or has space now is unknown");
});

test("Bangla: alerts and navigation use the agreed Bangla terms, not English", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "bn");
    } catch {}
  });
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { level: 1, name: "জেলার বন্যা সতর্কবার্তা" })).toBeVisible();
  await expect(page.getByRole("region", { name: "এই পূর্বাভাস সম্পর্কে" })).toContainText("নজরদারি ও সতর্কতা");
  await expect(page.locator("main")).not.toContainText("District flood warnings");
  await expect(page.locator("main")).not.toContainText("বিপদ সংকেত");
});
