import { test, expect } from "@playwright/test";

/**
 * Task fields, members and the activity feed:
 *  - type and story points chosen at creation show on the board card and in the sprint total;
 *  - assignee, points and labels can be changed on the task page and persist;
 *  - a project manager changes a member's role; a developer sees no role controls;
 *  - pending invitations are listed;
 *  - the dashboard feed names the task it is about, as a link.
 */

const API = "http://localhost:8123/api/v1"; // matches VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const unique = () => Date.now().toString().slice(-9) + Math.floor(Math.random() * 10);

async function registerUI(page, tag) {
  const id = unique();
  const email = `${tag}${id}@example.com`;
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(`${tag} ${id}`);
  await page.getByPlaceholder("john@example.com").fill(email);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  const me = (await (await page.request.get(`${API}/auth/current-user`)).json()).data;
  return { email, id: me._id, name: me.fullName };
}

const json = async (res) => (await res.json()).data;

test("type and points at creation, then assignee, points and labels on the task page", async ({ page }) => {
  await registerUI(page, "fields");
  const key = `F${unique().slice(-5)}`;
  const project = await json(await page.request.post(`${API}/projects`, { data: { name: `Fields ${key}`, key } }));

  await page.goto(`/dashboard/tasks?project=${project._id}`);
  await page.getByRole("button", { name: /New task/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Implement OAuth token exchange").fill("Checkout crashes on empty cart");
  await dialog.getByLabel("Type").selectOption("bug");
  await dialog.getByLabel("Story points").fill("5");
  await dialog.getByRole("button", { name: /Create task/i }).click();

  const card = page.locator("[data-card]").filter({ hasText: `${key}-1` });
  await expect(card).toBeVisible();
  await expect(card.getByRole("img", { name: "Bug" })).toBeVisible();
  await expect(card).toContainText("5");

  // Task page: assignee, points and labels
  await card.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout crashes on empty cart");
  const me = (await (await page.request.get(`${API}/auth/current-user`)).json()).data;
  await page.getByLabel("Assignee").selectOption(me._id);
  await page.getByLabel("Story points").fill("8");
  await page.getByLabel("Story points").press("Enter");
  await page.getByLabel("Add a label").fill("payments");
  await page.getByLabel("Add a label").press("Enter");
  await expect(page.getByRole("button", { name: "Remove label payments" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Assignee")).toHaveValue(me._id);
  await expect(page.getByLabel("Story points")).toHaveValue("8");
  await expect(page.getByRole("button", { name: "Remove label payments" })).toBeVisible();
  await expect(page.getByLabel("Type")).toHaveValue("bug");

  // Out-of-range points are refused before anything is sent.
  await page.getByLabel("Story points").fill("101");
  await page.getByLabel("Story points").press("Enter");
  await expect(page.getByText("Use a whole number from 0 to 100.")).toBeVisible();

  // Sprint total uses the points.
  const sprint = await json(await page.request.post(`${API}/projects/${project._id}/sprints`, {
    data: { name: "Sprint A", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * 864e5).toISOString() },
  }));
  const task = (await json(await page.request.get(`${API}/tasks/${project._id}`))).tasks[0];
  await page.request.put(`${API}/tasks/${project._id}/t/${task._id}`, { data: { sprint: sprint._id } });
  await page.goto(`/dashboard/projects/${project._id}?tab=sprints`);
  await expect(page.locator(`section[aria-label="Sprint A"]`)).toContainText("0 of 8 points");

  // Dashboard feed names the task, as a link to it.
  await page.goto("/dashboard");
  const link = page.getByRole("link", { name: `${key}-1 Checkout crashes on empty cart` }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout crashes on empty cart");
});

test("members: role changes by a manager, read-only for a developer, pending invitations listed", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const devCtx = await browser.newContext();
  const pendingCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const devPage = await devCtx.newPage();
  const pendingPage = await pendingCtx.newPage();

  await registerUI(owner, "owner");
  const dev = await registerUI(devPage, "dev");
  const pending = await registerUI(pendingPage, "pending");

  const key = `M${unique().slice(-5)}`;
  const project = await json(await owner.request.post(`${API}/projects`, { data: { name: `Members ${key}`, key } }));
  await owner.request.post(`${API}/projects/${project._id}/members`, { data: { email: dev.email, role: "developer" } });
  await devPage.request.post(`${API}/projects/${project._id}/invitations/accept`);
  await owner.request.post(`${API}/projects/${project._id}/members`, { data: { email: pending.email, role: "viewer" } });

  await owner.goto(`/dashboard/projects/${project._id}?tab=members`);
  await expect(owner.getByRole("heading", { name: /Waiting to accept/ })).toBeVisible();
  await expect(owner.getByText(pending.email)).toBeVisible();

  const roleOfDev = owner.getByLabel(`Role of ${dev.name}`);
  await roleOfDev.selectOption("qa");
  await expect(owner.getByText(`${dev.name} is now qa`)).toBeVisible();
  await owner.reload();
  await expect(owner.getByLabel(`Role of ${dev.name}`)).toHaveValue("qa");

  // The developer (now QA) sees roles as text and no invite form or remove buttons.
  await devPage.goto(`/dashboard/projects/${project._id}?tab=members`);
  await expect(devPage.locator("#members-heading")).toBeVisible();
  await expect(devPage.getByLabel(/^Role of /)).toHaveCount(0);
  await expect(devPage.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await expect(devPage.getByRole("button", { name: "Send invitation" })).toHaveCount(0);

  await Promise.all([ownerCtx.close(), devCtx.close(), pendingCtx.close()]);
});
