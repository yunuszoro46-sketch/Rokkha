import { test, expect, type Page } from "@playwright/test";

// Faults reported by the user on 19 Nov 2026: Bangla navbar gap, coordinates shown to citizens,
// shelter distances not from the visitor's location, and "Check a place" doing nothing.

async function open(page: Page, path: string, lang = "en") {
  await page.addInitScript((l) => {
    try {
      localStorage.setItem("rokkha_lang", l);
    } catch {}
  }, lang);
  await page.goto(path);
}

test("Bangla navbar fills its row like English: no large empty gap after the logo", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  for (const lang of ["en", "bn"]) {
    await open(page, "/", lang);
    await page.waitForLoadState("networkidle");
    const gap = await page.evaluate(() => {
      const nav = document.querySelector("header nav")!.querySelector("ul, button, a")!.closest("nav")!;
      const first = nav.querySelector("button, a")!.getBoundingClientRect();
      const logo = document.querySelector("header img")!.getBoundingClientRect();
      return first.left - logo.right;
    });
    expect(gap, lang).toBeLessThan(160);
  }
});

test("citizen pages show place names, never latitude / longitude", async ({ page }) => {
  for (const path of ["/shelters", "/alerts", "/"]) {
    await open(page, path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).not.toContainText(/\d+\.\d+\s*°\s*[NE]/);
  }
  // the district report too
  await open(page, "/shelters");
  await page.getByRole("button", { name: /My District Report/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText(/\d+\.\d+\s*°\s*[NE]/);
});

test("shelters say where distances are measured from, and switch to the visitor's own location", async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 24.9105, longitude: 91.2398, accuracy: 12 },
    permissions: ["geolocation"],
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await open(page, "/shelters");
  const origin = page.getByRole("status").filter({ hasText: /Distances are from/ });
  await expect(origin).toContainText("not from where you are");
  await origin.getByRole("button", { name: "Use my location" }).click();
  await expect(origin).toContainText("Distances are from your current location", { timeout: 30_000 });
  await expect(origin).toContainText(/Sunamganj/); // a place name, not numbers
  await expect(page.locator("main")).not.toContainText(/\d+\.\d+\s*°\s*[NE]/);
  await ctx.close();
});

test("'Check a place' opens the map ready to check one spot, and a tap shows that spot's check", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: "Flood intelligence" }).click();
  await nav.getByText("Check a place", { exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  const prompt = page.getByRole("region", { name: "Check a place" });
  await expect(prompt).toContainText("Tap the place you want to check");
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  // A spot in the middle of Bangladesh (Dhaka division): one tap runs the check, no drilling first.
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="rk-point-title"]')).toBeVisible({ timeout: 15_000 });
});

test("logged in (English and Bangla), the menu never covers the logo and fits its row", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "local admin account not set up");
  await open(page, "/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  for (const lang of ["en", "bn"]) {
    await page.evaluate((l) => localStorage.setItem("rokkha_lang", l), lang);
    for (const width of [1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const m = await page.evaluate(() => {
        const logo = document.querySelector("header img")!.getBoundingClientRect();
        const nav = document.querySelector("header nav") as HTMLElement;
        const first = nav.querySelector("button, a")!.getBoundingClientRect();
        return { gap: first.left - logo.right, fits: nav.scrollWidth <= nav.clientWidth };
      });
      expect(m.gap, `${lang} ${width}`).toBeGreaterThan(8);
      expect(m.fits, `${lang} ${width}`).toBe(true);
    }
  }
});
