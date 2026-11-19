import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";

// Local test accounts (rescue board tests) live in .env.e2e.local, which git ignores. It is made by
// Backend/scripts/seed_local_test_accounts.py's instructions; values already in the environment win.
if (existsSync(".env.e2e.local")) {
  for (const line of readFileSync(".env.e2e.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// Browser tests for the portal (docs/MAPPING_UX_PRODUCTION_AUDIT.md). They run against an already running
// portal + backend (default: the local preview on http://localhost:3100 with a LOCAL test database).
//   npm run test:unit         pure logic, no browser
//   npm run test:e2e          map and page workflows in Google Chrome (installed system browser)
// Set E2E_BASE_URL to test another address. Never point these tests at production with real accounts.
export default defineConfig({
  testDir: "tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: "e2e",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } },
    },
  ],
});
