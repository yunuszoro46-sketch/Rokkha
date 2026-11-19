import { test, expect, type Browser, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "crypto";

// The shared rescue board, end to end, with two real rescuer accounts in two different teams.
// Needs the LOCAL test accounts (Backend/scripts/seed_local_test_accounts.py, values in .env.e2e.local)
// and a backend on the LOCAL test database. Each run creates two help requests (the backend allows
// 10 new requests per connection per hour, so about five runs an hour).

const API = process.env.E2E_API_URL || "http://localhost:8001/api/v1";
const A = { email: process.env.E2E_RESCUER_EMAIL, password: process.env.E2E_RESCUER_PASSWORD, team: "Local Test Team A" };
const B = { email: process.env.E2E_RESCUER2_EMAIL, password: process.env.E2E_RESCUER2_PASSWORD, team: "Local Test Team B" };
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };

test.skip(!A.email || !B.email || !ADMIN.email, "local test accounts not set up (see Backend/scripts/seed_local_test_accounts.py)");
test.describe.configure({ mode: "serial" });

async function sendRequest(request: APIRequestContext, note: string) {
  const clientId = randomUUID(); // the sender's own key; the server stores it unreadable and never returns it
  const res = await request.post(`${API}/sos`, {
    data: {
      client_id: clientId,
      needs: ["evacuation"],
      people: 3,
      location: { type: "Point", coordinates: [91.1428, 24.8474] },
      location_source: "gps",
      accuracy_m: 15,
      note,
      contact_name: "E2E test (not a real person)",
      contact_phone: "+880 1700 000000",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { ...((await res.json()) as { id: string; reference: string }), client_id: clientId };
}

async function token(request: APIRequestContext, who: { email?: string; password?: string }) {
  const res = await request.post(`${API}/auth/login`, { data: { email: who.email, password: who.password } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token as string;
}

async function rescuerPage(browser: Browser, who: { email?: string; password?: string }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("rokkha_lang", "en");
    } catch {}
  });
  page.on("dialog", (d) => d.accept()); // release asks for confirmation
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email!);
  await page.getByLabel("Password", { exact: true }).fill(who.password!);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/rescue$/);
  await expect(page.getByRole("heading", { name: "Rescue board", exact: true })).toBeVisible();
  return page;
}

const card = (page: Page, reference: string) => page.locator("article").filter({ hasText: reference });

test("two teams press Accept together: exactly one gets it, the other is told and both boards agree", async ({ browser, request }) => {
  const sent = await sendRequest(request, "E2E: two teams accept at once");
  const [a, b] = await Promise.all([rescuerPage(browser, A), rescuerPage(browser, B)]);
  for (const p of [a, b]) {
    await p.getByRole("button", { name: "Refresh" }).click();
    await expect(card(p, sent.reference).getByRole("button", { name: "Accept this request" })).toBeVisible();
  }

  await Promise.all([
    card(a, sent.reference).getByRole("button", { name: "Accept this request" }).click(),
    card(b, sent.reference).getByRole("button", { name: "Accept this request" }).click(),
  ]);

  // The backend decides: one primary team, recorded once.
  const admin = await token(request, ADMIN);
  const board = await (await request.get(`${API}/sos`, { headers: { Authorization: `Bearer ${admin}` } })).json();
  const stored = board.requests.find((r: any) => r.id === sent.id);
  expect(stored.status).toBe("accepted");
  expect([A.team, B.team]).toContain(stored.team.name);
  expect(stored.history.filter((s: any) => s.event === "accepted")).toHaveLength(1);

  const [winner, loser] = stored.team.name === A.team ? [a, b] : [b, a];
  await expect(winner.getByRole("status").filter({ hasText: `accepted ${sent.reference}` })).toBeVisible();
  await expect(loser.getByRole("alert").filter({ hasText: "The board has been refreshed." })).toBeVisible();
  // Both boards show the same authoritative state; only the winner can move it on.
  for (const p of [winner, loser]) await expect(card(p, sent.reference)).toContainText("Accepted");
  await expect(card(loser, sent.reference).getByRole("button", { name: "Accept this request" })).toHaveCount(0);
  await expect(card(loser, sent.reference).getByRole("button", { name: "We are on our way" })).toHaveCount(0);

  // Accepting did NOT mark the team en route: that is a separate, explicit step.
  const w = card(winner, sent.reference);
  await expect(w).toContainText("Accepted");
  await expect(w).not.toContainText("Team en route");

  // The full lifecycle, one explicit step at a time.
  await w.getByRole("button", { name: "We are on our way" }).click();
  await expect(w).toContainText("Team en route");
  await w.getByRole("button", { name: "We have arrived" }).click();
  await expect(w).toContainText("Team arrived");
  await w.getByRole("button", { name: "Help in progress" }).click();
  await expect(w).toContainText("Help in progress");
  await w.getByRole("button", { name: "Help completed" }).click();

  const done = await (await request.get(`${API}/sos?status=completed`, { headers: { Authorization: `Bearer ${admin}` } })).json();
  const final = done.requests.find((r: any) => r.id === sent.id);
  expect(final.status).toBe("completed");
  expect(final.history.map((s: any) => s.event)).toEqual(expect.arrayContaining(["accepted", "en_route", "arrived", "in_progress", "completed"]));
  // Every step after acceptance names the team that did it.
  for (const step of final.history.filter((s: any) => s.event !== "received")) expect(step.team?.name).toBe(stored.team.name);

  // The person who asked sees the real status with their own key.
  const status = await (await request.get(`${API}/sos/status/${sent.client_id}`)).json();
  expect(status.status).toBe("completed");

  await a.context().close();
  await b.context().close();
});

test("a team releases a request with a reason; it returns to the shared board and another team takes it", async ({ browser, request }) => {
  const sent = await sendRequest(request, "E2E: release and reassignment");
  const a = await rescuerPage(browser, A);
  await a.getByRole("button", { name: "Refresh" }).click();
  const ca = card(a, sent.reference);
  await ca.getByRole("button", { name: "Accept this request" }).click();
  await expect(ca).toContainText("Accepted");
  await ca.getByRole("button", { name: "Release: Could not reach the place" }).click();
  await expect(a.getByRole("status").filter({ hasText: `${sent.reference} is back on the board` })).toBeVisible();
  await expect(ca).toContainText("Waiting for a team");

  const b = await rescuerPage(browser, B);
  await b.getByRole("button", { name: "Refresh" }).click();
  const cb = card(b, sent.reference);
  await expect(cb).toContainText("Waiting for a team");
  await cb.getByRole("button", { name: "Accept this request" }).click();
  await expect(cb).toContainText("Accepted");

  const admin = await token(request, ADMIN);
  const board = await (await request.get(`${API}/sos`, { headers: { Authorization: `Bearer ${admin}` } })).json();
  const stored = board.requests.find((r: any) => r.id === sent.id);
  expect(stored.team.name).toBe(B.team);
  expect(stored.releases.at(-1).reason).toBe("unable_to_reach");
  expect(stored.releases.at(-1).team.name).toBe(A.team);

  // Clean up the local test data: an admin closes it so it does not stay on the local board.
  const closed = await request.post(`${API}/sos/${sent.id}/close`, { headers: { Authorization: `Bearer ${admin}` }, data: { reason: "other", note: "E2E test request" } });
  expect(closed.ok()).toBeTruthy();
  await a.context().close();
  await b.context().close();
});

test("only rescuers and admins reach the board; a rescuer cannot use admin routes", async ({ page, request }) => {
  // Not logged in: the page says who it is for, and the API refuses.
  await page.goto("/rescue");
  await expect(page.getByText("This page is for rescue teams.")).toBeVisible();
  expect((await request.get(`${API}/sos`)).status()).toBe(401);
  // A rescuer is not an admin.
  const rescuer = await token(request, A);
  expect((await request.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${rescuer}` } })).status()).toBe(403);
  expect((await request.get(`${API}/admin/teams`, { headers: { Authorization: `Bearer ${rescuer}` } })).status()).toBe(403);
});
