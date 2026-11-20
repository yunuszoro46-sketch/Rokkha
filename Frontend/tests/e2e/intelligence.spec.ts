import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
});

test("intelligence page: title, sections and live model facts", async ({ page }) => {
  await page.goto("/intelligence");
  await expect(page).toHaveTitle(/Rokkha Intelligence/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("From environmental data to flood intelligence");
  for (const name of ["Data sources", "Processing pipeline", "ML methodology", "Model evaluation", "Research insights", "Geospatial analysis", "Engineering milestones", "Limitations", "Technical breakdown"]) {
    await expect(page.getByRole("navigation", { name: "Sections of this page" }).getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Model: xgb-/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance across evaluation periods" })).toBeVisible();
  await expect(page.getByText(/reviewer|judge/i)).toHaveCount(0);
});

test("pipeline steps can be chosen and explain in/out", async ({ page }) => {
  await page.goto("/intelligence#pipeline");
  await page.getByRole("button", { name: /Satellite flood observations/ }).click();
  await expect(page.locator("#pipeline aside")).toContainText("Copernicus GFM");
  await page.getByRole("button", { name: /Point record \(separate\)/ }).click();
  await expect(page.locator("#pipeline aside")).toContainText("Not part of the model");
});

test("importance shows river flow separately from distance (audited figure)", async ({ page }) => {
  await page.goto("/intelligence#engine");
  await expect(page.locator("#engine").getByText("River flow", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#engine").getByText(/Geography \(distance to river, hazard zones\)/).first()).toBeVisible();
});

test("a district can be chosen on the Bangladesh map by keyboard", async ({ page }) => {
  await page.goto("/intelligence#bangladesh");
  const district = page.locator("#bangladesh").getByRole("button", { name: "Bandarban" });
  await district.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#bangladesh h3")).toHaveText("Bandarban");
  await expect(page.locator("#bangladesh")).toContainText("radar cannot observe it");
});

test("the About dialog is a short entry that leads to the page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "About", exact: true }).click();
  await page.getByRole("button", { name: "About Rokkha and its limits" }).click();
  await page.getByRole("button", { name: "Explore the Intelligence System" }).click();
  await expect(page).toHaveURL(/\/intelligence$/);
});

test("phone: no sideways scroll on the intelligence page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/intelligence");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("evaluation chart: metric switch and legend toggles change the chart", async ({ page }) => {
  await page.goto("/intelligence#performance");
  const fig = page.locator('figure[aria-labelledby="perf-t"]');
  await expect(fig.locator("svg[role=img]")).toHaveAttribute("aria-label", "PR-AUC by evaluation period");
  await fig.getByRole("button", { name: "Brier score" }).click();
  await expect(fig.locator("svg[role=img]")).toHaveAttribute("aria-label", "Brier score by evaluation period");
  const paths = () => fig.locator("svg[role=img] path").count();
  const before = await paths();
  await fig.getByRole("button", { name: "Persistence" }).click();
  await expect(fig.getByRole("button", { name: "Persistence" })).toHaveAttribute("aria-pressed", "false");
  expect(await paths()).toBe(before - 1);
});

test("satellite coverage chart: time range changes the shown months", async ({ page }) => {
  await page.goto("/intelligence#data");
  const fig = page.locator('figure[aria-labelledby="cov-t"]');
  const rows = () => fig.locator(".sr-only tbody tr").count();
  await expect.poll(rows).toBeGreaterThan(80); // all years loaded (88 months plus season gaps)
  const all = await rows();
  await fig.getByRole("button", { name: "Test 2023–24" }).click();
  await expect(fig.getByRole("button", { name: "Test 2023–24" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(rows).toBeLessThan(all);
  await expect(fig.getByText("2023").first()).toBeAttached();
});

test("dataset catalogue and glossary terms explain themselves", async ({ page }) => {
  await page.goto("/intelligence#data");
  await page.getByRole("tab", { name: /GloFAS river discharge/ }).click();
  await expect(page.locator("#rk-dataset-panel")).toContainText("Modelled flow, not gauge water level");
  const term = page.locator("#data").getByRole("button", { name: "radar satellite" });
  await term.click();
  await expect(page.locator("#data").getByRole("note")).toContainText("SAR (synthetic aperture radar)");
  await page.keyboard.press("Escape");
  await expect(page.locator("#data").getByRole("note")).toHaveCount(0);
});
