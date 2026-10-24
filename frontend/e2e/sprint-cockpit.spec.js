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

async function scrumSprint(owner, p, issues) {
  const sprint = await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint Tide", goal: "Ship it", startDate: iso(0), endDate: iso(9) } }));
  const created = [];
  for (const body of issues) {
    created.push(await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { ...body, sprint: sprint._id } })));
  }
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${sprint._id}/start`);
  return { sprint, created };
}

test("the board shows the sprint strip, marks a column over its WIP limit, and groups by assignee", async ({ browser, isMobile }) => {
  test.skip(isMobile, "Swimlanes are desktop-only by design");
  const owner = await person(browser, "board");
  const p = await project(owner);
  const { created } = await scrumSprint(owner, p, [
    { title: "Card form", storyPoints: 5, status: "in_progress", assignees: [owner.id] },
    { title: "Webhook retries", storyPoints: 3, status: "in_progress", assignees: [owner.id] },
    { title: "Stripe sandbox", storyPoints: 2 },
  ]);
  await owner.page.request.put(`${API}/tasks/${p._id}/t/${created[2]._id}`, { data: { status: "done" } });
  await owner.page.request.put(`${API}/projects/${p._id}`, { data: { wipLimits: { in_progress: 1 } } });

  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  const strip = owner.page.getByRole("group", { name: /Sprint Tide, day 1 of 10, 8 of 10 points left/ });
  await expect(strip).toBeVisible();
  await expect(strip).toContainText("Day 1 of 10");

  const header = owner.page.locator('[data-column-header="in_progress"]');
  await expect(header).toContainText("2 / 1");
  await expect(header).toHaveAttribute("data-over", "true");

  await owner.page.getByRole("button", { name: "By assignee" }).click();
  await expect(owner.page.getByRole("heading", { level: 3, name: new RegExp(`${owner.name}.*8 pts`) })).toBeVisible();
  await expect(owner.page.getByRole("heading", { level: 3, name: /Unassigned.*2 pts/ })).toBeVisible();
  await owner.context.close();
});

test("a move the server refuses snaps back", async ({ browser }) => {
  const owner = await person(browser, "snapown");
  const viewer = await person(browser, "snapview");
  const p = await project(owner);
  await owner.page.request.post(`${API}/projects/${p._id}/members`, { data: { email: viewer.email, role: "viewer" } });
  await viewer.page.request.post(`${API}/projects/${p._id}/invitations/accept`);
  const { created } = await scrumSprint(owner, p, [{ title: "Read only card", storyPoints: 1 }]);

  await viewer.page.goto(`/dashboard/projects/${p._id}/board`);
  const card = viewer.page.locator(`[data-card="${created[0]._id}"]`);
  await expect(viewer.page.locator('[data-column="todo"]').locator(`[data-card="${created[0]._id}"]`)).toBeVisible();
  await card.getByRole("button", { name: `Move ${created[0].issueKey}` }).click();
  await viewer.page.getByRole("menuitem", { name: "Move to Done" }).click();
  await expect(viewer.page.getByRole("alert")).toContainText(/not allowed|permission/i);
  await expect(viewer.page.locator('[data-column="todo"]').locator(`[data-card="${created[0]._id}"]`)).toBeVisible();
  await owner.context.close();
  await viewer.context.close();
});

test("a scrum project without an active sprint points to the backlog", async ({ browser }) => {
  const owner = await person(browser, "nosprint");
  const p = await project(owner);
  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.getByText("No active sprint")).toBeVisible();
  await owner.page.getByRole("link", { name: "Go to the backlog" }).click();
  await expect(owner.page).toHaveURL(/\/backlog$/);
  await owner.context.close();
});

test("a large Kanban board says how many issues it shows", async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await person(browser, "bigboard");
  const p = await project(owner, "kanban");
  for (let i = 0; i < 101; i++) {
    await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: `Issue ${i}`, status: "todo" } });
  }
  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.getByText("Showing the 100 most recent issues of 101.")).toBeVisible();
  await owner.context.close();
});

test("backlog: move an issue into a planned sprint, and over-commitment is flagged", async ({ browser }) => {
  const owner = await person(browser, "backlog");
  const p = await project(owner);
  // A completed sprint gives the team an average velocity of 5.
  const s1 = await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint One", startDate: iso(-14), endDate: iso(1) } }));
  const t1 = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Shipped", storyPoints: 5, sprint: s1._id } }));
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${s1._id}/start`);
  await owner.page.request.put(`${API}/tasks/${p._id}/t/${t1._id}`, { data: { status: "done" } });
  await owner.page.request.post(`${API}/projects/${p._id}/sprints/${s1._id}/complete`, { data: {} });

  await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint Two", startDate: iso(1), endDate: iso(14) } }));
  const big = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Saved cards", storyPoints: 13 } }));

  await owner.page.goto(`/dashboard/projects/${p._id}/backlog`);
  const backlog = owner.page.locator('section[aria-label="Backlog"]');
  await backlog.getByRole("button", { name: `Move ${big.issueKey}` }).click();
  // Wait for the save before reloading, or the reload can race the PUT.
  const saved = owner.page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/tasks/"));
  await owner.page.getByRole("menuitem", { name: "Move to Sprint Two" }).click();

  const two = owner.page.locator('section[aria-label="Sprint Two"]');
  await expect(two).toContainText("Saved cards");
  await expect(two).toContainText("13 pts planned · team averages 5");

  await saved;
  await owner.page.reload();
  await expect(owner.page.locator('section[aria-label="Sprint Two"]')).toContainText("Saved cards");
  await owner.context.close();
});

test("a manager sets a WIP limit in Project settings and the board marks the column", async ({ browser, isMobile }) => {
  test.skip(isMobile, "Column headers are compared side by side on desktop");
  const owner = await person(browser, "wipui");
  const p = await project(owner);
  await scrumSprint(owner, p, [{ title: "One", status: "in_progress" }, { title: "Two", status: "in_progress" }]);

  await owner.page.goto(`/dashboard/projects/${p._id}/settings`);
  await owner.page.getByLabel("In Progress limit").fill("1");
  await owner.page.getByRole("button", { name: "Save limits" }).click();
  await expect(owner.page.getByText("WIP limits saved")).toBeVisible();

  await owner.page.goto(`/dashboard/projects/${p._id}/board`);
  await expect(owner.page.locator('[data-column-header="in_progress"]')).toContainText("2 / 1");
  await owner.context.close();
});

test("issue view: change status from the status control and see it in History", async ({ browser }) => {
  const owner = await person(browser, "issue");
  const p = await project(owner);
  const task = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Track me", originalEstimate: 420 } }));

  await owner.page.goto(`/dashboard/tasks/${task._id}?projectId=${p._id}`);
  await expect(owner.page.getByText("7h estimate")).toBeVisible();
  await owner.page.getByLabel("Status").selectOption("in_progress");
  await expect(owner.page.getByLabel("Status")).toHaveValue("in_progress");

  await owner.page.getByRole("tab", { name: "History" }).click();
  const history = owner.page.getByRole("tabpanel");
  await expect(history).toContainText(owner.name);
  await expect(history).toContainText(/To Do/i);
  await expect(history).toContainText(/In Progress/i);
  await owner.context.close();
});

test("your work shows each project's sprint health and what is assigned to me", async ({ browser }) => {
  const owner = await person(browser, "yours");
  const p = await project(owner);
  await scrumSprint(owner, p, [{ title: "My open issue", storyPoints: 3, assignees: [owner.id] }]);

  await owner.page.goto("/dashboard");
  const card = owner.page.getByRole("link", { name: new RegExp(p.name) }).filter({ hasText: "day 1 of 10" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/On track|At risk|Off track/);
  await expect(owner.page.getByRole("tab", { name: /Assigned to me 1/ })).toBeVisible();
  await expect(owner.page.getByRole("tabpanel")).toContainText("My open issue");
  await owner.context.close();
});

test("backlog: search hides non-matching rows and Create issue opens the dialog", async ({ browser }) => {
  const owner = await person(browser, "bsearch");
  const p = await project(owner);
  for (const title of ["Alpha login form", "Beta export job"]) {
    await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title } });
  }
  await owner.page.goto(`/dashboard/projects/${p._id}/backlog`);
  const backlog = owner.page.locator('section[aria-label="Backlog"]');
  await expect(backlog).toContainText("Alpha login form");
  await expect(backlog).toContainText("Beta export job");

  await owner.page.getByLabel("Search backlog").fill("alpha");
  await expect(backlog).toContainText("Alpha login form");
  await expect(backlog).not.toContainText("Beta export job");

  await backlog.getByRole("button", { name: "Create issue" }).click();
  await expect(owner.page.getByRole("dialog")).toBeVisible();
  await owner.context.close();
});

test("child issues are listed on the parent, and the child links back", async ({ browser }) => {
  const owner = await person(browser, "kids");
  const p = await project(owner);
  const parent = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Checkout epic", issueType: "epic" } }));
  const child = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Apple Pay button", parent: parent._id } }));

  await owner.page.goto(`/dashboard/tasks/${parent._id}?projectId=${p._id}`);
  const kids = owner.page.locator('section[aria-labelledby="children-heading"]');
  await expect(kids).toContainText("Apple Pay button");
  await expect(kids).toContainText(child.issueKey);

  await kids.getByRole("link", { name: "Apple Pay button" }).click();
  await expect(owner.page.getByRole("link", { name: parent.issueKey, exact: true })).toBeVisible();
  await owner.context.close();
});

test("issue view: Sprint and Due date save inline", async ({ browser }) => {
  const owner = await person(browser, "inline");
  const p = await project(owner);
  const sprint = await json(await owner.page.request.post(`${API}/projects/${p._id}/sprints`, { data: { name: "Sprint Inline", startDate: iso(1), endDate: iso(14) } }));
  const task = await json(await owner.page.request.post(`${API}/tasks/${p._id}`, { data: { title: "Plan me" } }));

  await owner.page.goto(`/dashboard/tasks/${task._id}?projectId=${p._id}`);
  await owner.page.getByLabel("Sprint").selectOption({ label: "Sprint Inline" });
  await owner.page.getByLabel("Due date").fill("2031-03-05");
  await expect.poll(async () => {
    const t = await json(await owner.page.request.get(`${API}/tasks/${p._id}/t/${task._id}`));
    return [t.sprint?._id, (t.dueDate ?? "").slice(0, 10)];
  }).toEqual([sprint._id, "2031-03-05"]);
  await owner.context.close();
});
