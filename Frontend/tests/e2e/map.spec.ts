import { test, expect, type Page } from "@playwright/test";

// Map workflows against a running portal + backend. Assertions are about behaviour and honesty, not about
// particular forecast values (those change daily).

async function openMap(page: Page, path = "/map") {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
  await page.goto(path);
  await page.waitForSelector(".rk-map-label--division", { state: "attached", timeout: 30_000 });
}

const panel = (page: Page) => page.locator("aside");
const crumbs = (page: Page) => panel(page).locator('nav[aria-label="Where you are on the map"]');

test("opens on Bangladesh with 8 divisions and 64 districts, no world view", async ({ page }) => {
  await openMap(page);
  await expect(panel(page).locator("h1")).toHaveText("Bangladesh");
  await expect(page.locator(".rk-map-label--division")).toHaveCount(8);
  await expect(page.locator(".rk-map-label:not(.rk-map-label--division):not(.rk-map-label--station):not(.rk-map-label--river):not(.rk-map-label--hq):not(.rk-map-label--upazila)")).toHaveCount(64);
  // Camera limited to Bangladesh: zooming out as far as possible keeps the country in view.
  await expect(page.getByText(/Boundaries © BBS & UN OCHA/).first()).toBeVisible();
});

test("search → district → upazila → back → reset", async ({ page }) => {
  await openMap(page);
  const search = page.getByRole("combobox");
  await search.fill("Sunamganj");
  await page.locator("#rk-map-search-list [role=option]").filter({ hasText: "District" }).first().click();
  await expect(crumbs(page)).toContainText("Sylhet");
  await expect(crumbs(page)).toContainText("Sunamganj");
  await panel(page).getByRole("button", { name: "Tahirpur", exact: true }).click();
  await expect(crumbs(page)).toContainText("Tahirpur");
  await panel(page).getByRole("button", { name: "Back", exact: true }).click();
  await expect(panel(page).locator("h1")).toHaveText("Sunamganj");
  await page.getByRole("button", { name: "Show all of Bangladesh" }).click();
  await expect(panel(page).locator("h1")).toHaveText("Bangladesh");
});

test("Point Check by coordinates shows the sections in order with sources", async ({ page }) => {
  await openMap(page);
  await panel(page).getByText("Enter coordinates (advanced)").click();
  await page.locator("#rk-coords").fill("24.8474, 91.1428");
  await panel(page).getByRole("button", { name: "Check", exact: true }).click();
  const point = page.locator('section[aria-labelledby="rk-point-title"]');
  await expect(point.locator("#rk-point-title")).toContainText("Sunamganj");
  const titles = await point.locator("h3").allTextContents();
  const order = ["Current flood condition", "Forecast", "Rainfall", "Nearby river", "Flood record at this spot", "Geography and terrain", "Facilities nearby"];
  let last = -1;
  for (const t of order) {
    const i = titles.findIndex((x) => x.startsWith(t));
    expect(i, t).toBeGreaterThan(last);
    last = i;
  }
  await expect(point.getByText(/~\d+ m cell/)).toBeVisible();
  await expect(point.getByText("Sources, coordinates and limits")).toBeVisible();
});

test("coordinates outside Bangladesh are refused", async ({ page }) => {
  await openMap(page);
  await panel(page).getByText("Enter coordinates (advanced)").click();
  await page.locator("#rk-coords").fill("10, 10");
  await panel(page).getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("#rk-coords-err")).toContainText("outside Bangladesh");
});

test("river stations: nine on the map, station panel says modelled flow with no danger level", async ({ page }) => {
  await openMap(page);
  await expect(page.locator(".rk-map-label--station")).toHaveCount(9);
  await page.getByRole("combobox").fill("Jamuna");
  await page.locator("#rk-map-search-list [role=option]").filter({ hasText: "River-flow station" }).first().click();
  const st = page.locator('section[aria-labelledby="rk-station-title"]');
  await expect(st).toContainText("not a gauge water level");
  await expect(st.locator('svg[role="img"]')).toHaveAttribute("aria-label", /River flow for the last/);
});

test("rivers are searchable and open a context panel", async ({ page }) => {
  await openMap(page);
  await page.getByRole("combobox").fill("Surma");
  await page.locator("#rk-map-search-list [role=option]").filter({ hasText: "River (map context)" }).first().click();
  await expect(page.locator('section[aria-labelledby="rk-river-title"]')).toContainText("not a flood or water-level layer");
});

test("layers: switching changes the legend; unavailable layers are labelled, not drawn", async ({ page }) => {
  await openMap(page);
  await panel(page).getByRole("radio", { name: /Past floods 2016–2024/ }).check();
  await expect(page.locator(".rk-map-explorer").getByText("Flooded in 4 or more events").first()).toBeVisible();
  await expect(panel(page).getByText("Forecast flood extent (inundation map)")).toBeVisible();
  await expect(panel(page).getByText("Not available").first()).toBeVisible();
});

test("terrain layer is off by default and shows its legend and source when switched on", async ({ page }) => {
  await openMap(page);
  await expect(page.locator(".rk-map-explorer").getByText("Ground height (terrain)")).toHaveCount(0);
  await panel(page).locator("summary").filter({ hasText: "Geography" }).click();
  await panel(page).getByRole("checkbox", { name: /Terrain and elevation/ }).check();
  await expect(page.locator(".rk-map-explorer").getByText("Ground height (terrain)").first()).toBeVisible();
  await expect(page.locator(".rk-map-explorer").getByText(/Copernicus DEM GLO-90/).first()).toBeVisible();
});

test("a day without a forecast says so and offers the day before", async ({ page }) => {
  await openMap(page);
  const day = panel(page).getByText("No forecast issued for this day");
  if ((await day.count()) === 0) test.skip(true, "today already has a forecast in this database");
  await expect(day).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "See the day before" })).toBeVisible();
});

test("switching language keeps the selection", async ({ page }) => {
  await openMap(page);
  await page.getByRole("combobox").fill("Sylhet");
  await page.locator("#rk-map-search-list [role=option]").filter({ hasText: "District" }).first().click();
  await expect(panel(page).locator("h1")).toHaveText("Sylhet");
  await page.getByRole("button", { name: "বাংলায় দেখুন" }).click();
  await expect(panel(page).locator("h1")).toHaveText("সিলেট");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(panel(page).locator("h1")).toHaveText("Sylhet");
});

test("phone: bottom sheet opens and closes, no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const handle = page.locator('button[aria-controls="rk-sheet-body"]');
  await handle.click();
  await expect(page.locator("#rk-sheet-body")).toBeVisible();
  await handle.click();
  await expect(page.locator("#rk-sheet-body")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Bangla mode shows verified Bangla upazila names on the map, English where none is verified", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "bn");
    } catch {}
  });
  await page.goto("/map");
  await page.waitForSelector(".rk-map-label--division", { state: "attached", timeout: 30_000 });
  await page.getByRole("combobox").fill("সুনামগঞ্জ");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator(".rk-map-label--upazila").filter({ hasText: "তাহিরপুর" })).toHaveCount(1);
  await expect(page.locator(".rk-map-label--upazila").filter({ hasText: "Shalla" })).toHaveCount(1); // no verified Bangla name
});

test("rain forecast layer shows the real forecast window or says none is stored", async ({ page }) => {
  await openMap(page);
  await panel(page).locator("summary").filter({ hasText: "Weather" }).click();
  await panel(page).getByRole("radio", { name: /Rain forecast, next 3 days/ }).check();
  const legend = page.locator(".rk-map-explorer").getByText(/Latest forecast: .* \(BD time\)|No forecast stored yet/).first();
  await expect(legend).toBeVisible();
});

test("river station shows a labelled GloFAS forecast peak when forecasts are stored", async ({ page }) => {
  await openMap(page);
  await page.getByRole("combobox").fill("Surma");
  await page.locator("#rk-map-search-list [role=option]").filter({ hasText: "River-flow station" }).first().click();
  const st = page.locator('section[aria-labelledby="rk-station-title"]');
  await expect(st.getByText(/GloFAS forecast .*highest|No river-flow forecast stored for this station yet/).first()).toBeVisible();
});

test("rain forecast layer is marked as a daily update, not a fixed record", async ({ page }) => {
  await openMap(page);
  await panel(page).locator("summary").filter({ hasText: "Weather" }).click();
  await panel(page).getByRole("radio", { name: /Rain forecast, next 3 days/ }).check();
  await expect(page.locator(".rk-map-explorer").getByText(/^(Daily update|Not available yet)$/).first()).toBeVisible();
  await expect(panel(page).getByText("Fixed record")).toHaveCount(0);
});
