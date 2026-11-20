import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated WCAG 2.2 A/AA checks (axe-core) on the main pages, in English and Bangla, plus the dialogs.
// This catches machine-checkable problems only (contrast, names, ARIA, structure); it is not a full
// WCAG audit and not a screen-reader test.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoSerious(page: Page, what: string, exclude: string[] = []) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const sel of exclude) builder = builder.exclude(sel);
  const r = await builder.analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(report, `${what}\n${report.join("\n")}`).toEqual([]);
}

async function open(page: Page, path: string, lang: string) {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem("rokkha_lang", l);
    } catch {}
  }, lang);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

for (const lang of ["en", "bn"]) {
  for (const path of ["/", "/map", "/alerts", "/shelters", "/contacts", "/intelligence", "/login", "/rescue"]) {
    test(`axe: ${path} (${lang})`, async ({ page }) => {
      await open(page, path, lang);
      await expectNoSerious(page, `${path} ${lang}`);
    });
  }
}

test("axe: help-request dialog and district report dialog", async ({ page }) => {
  await open(page, "/", "en");
  await page.locator("main").getByRole("button", { name: "Request assistance" }).first().click();
  await expect(page.getByRole("dialog", { name: "Ask for emergency help" })).toBeVisible();
  await expectNoSerious(page, "help-request dialog");
  await page.keyboard.press("Escape");

  await open(page, "/shelters", "en");
  await page.getByRole("button", { name: /My District Report/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(1000);
  // Leaflet pins can sit closer than 24 px; WCAG 2.5.8's "equivalent" exception applies because the same
  // places are listed as text under the map. Their names are still checked (title on each pin).
  await expect(page.getByRole("dialog").getByText("Places on the map")).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(TAGS).disableRules(["target-size"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("axe: map with a district selected", async ({ page }) => {
  await open(page, "/map", "en");
  await page.getByRole("button", { name: "Sylhet", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await expectNoSerious(page, "map, Sylhet selected");
});

test("axe: Admin Control Centre sections (local admin account)", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "local admin account not set up");
  await open(page, "/login", "en");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  for (const s of ["overview", "rescue", "alerts", "data", "analytics", "users", "teams", "health", "audit", "settings"]) {
    await page.goto(`/admin/${s}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expectNoSerious(page, `/admin/${s}`);
  }
});
