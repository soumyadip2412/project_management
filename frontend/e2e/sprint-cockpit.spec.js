import { test, expect } from "@playwright/test";

/**
 * The project workspace: old links, board and sprint strip, backlog, WIP
 * limits, the issue view and Your work. Data is arranged through the API;
 * the UI is then checked as a user sees it.
 */

const API = "http://localhost:8123/api/v1"; // matches VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const DAY = 864e5;
const unique = () => Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
const json = async (res) => (await res.json()).data;
const iso = (days) => new Date(Date.now() + days * DAY).toISOString();

async function person(browser, tag) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const id = unique();
  const email = `${tag}${id}@example.com`;
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(`${tag} ${id}`);
  await page.getByPlaceholder("john@example.com").fill(email);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  const me = await json(await page.request.get(`${API}/auth/current-user`));
  return { context, page, email, id: me._id, name: me.fullName };
}

async function project(owner, methodology = "scrum") {
  const key = `S${unique().slice(-5)}`;
  return json(await owner.page.request.post(`${API}/projects`, { data: { name: `Cockpit ${key}`, key, methodology } }));
}

test("old ?tab= links land on the new routes", async ({ browser }) => {
  const owner = await person(browser, "links");
  const p = await project(owner);
  for (const [tab, route] of [["overview", "summary"], ["tasks", "issues"], ["sprints", "backlog"], ["notes", "notes"], ["members", "members"], ["settings", "settings"]]) {
    await owner.page.goto(`/dashboard/projects/${p._id}?tab=${tab}`);
    await expect(owner.page).toHaveURL(new RegExp(`/dashboard/projects/${p._id}/${route}$`));
  }
  await owner.page.goto(`/dashboard/projects/${p._id}`);
  await expect(owner.page).toHaveURL(new RegExp(`/dashboard/projects/${p._id}/board$`));
  // Unknown or prototype-key values fall back to the default view instead of crashing.
  for (const tab of ["constructor", "toString", "nonsense"]) {
    await owner.page.goto(`/dashboard/projects/${p._id}?tab=${tab}`);
    await expect(owner.page).toHaveURL(new RegExp(`/dashboard/projects/${p._id}/board$`));
  }
  await owner.context.close();
});
