import { test, expect } from "@playwright/test";

/**
 * Collaboration features, with real roles in separate browser sessions:
 *  - comments: edit your own, react, @mentions highlighted, a manager can
 *    delete someone else's comment but a developer cannot;
 *  - notes: managers write, developers read;
 *  - opening a notification marks it read;
 *  - sprint charts: burndown for the active sprint, velocity after one completes.
 */

const API = "http://localhost:8123/api/v1"; // matches VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const unique = () => Date.now().toString().slice(-8) + Math.floor(Math.random() * 100);
const json = async (res) => (await res.json()).data;

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
  return { context, page, email, id: me._id, name: me.fullName, username: me.username };
}

/** Owner creates a project and brings `dev` in as a developer. */
async function projectWith(owner, dev) {
  const key = `C${unique().slice(-5)}`;
  const project = await json(await owner.page.request.post(`${API}/projects`, { data: { name: `Collab ${key}`, key } }));
  await owner.page.request.post(`${API}/projects/${project._id}/members`, { data: { email: dev.email, role: "developer" } });
  await dev.page.request.post(`${API}/projects/${project._id}/invitations/accept`);
  return project;
}

test("comments: edit, react, mentions, moderation", async ({ browser }) => {
  const owner = await person(browser, "own");
  const dev = await person(browser, "dev");
  const project = await projectWith(owner, dev);
  const task = await json(await owner.page.request.post(`${API}/tasks/${project._id}`, { data: { title: "Discuss me" } }));
  const taskUrl = `/dashboard/tasks/${task._id}?projectId=${project._id}`;

  // Developer comments, mentioning the owner, then edits it.
  await dev.page.goto(taskUrl);
  await dev.page.getByPlaceholder(/Write a comment/).fill(`Looks wrong to me @${owner.username}`);
  await dev.page.getByRole("button", { name: "Comment", exact: true }).click();
  const devComment = dev.page.locator("li").filter({ hasText: "Looks wrong to me" });
  await expect(devComment.getByText(`@${owner.username}`)).toHaveClass(/text-primary/);

  await devComment.getByRole("button", { name: "Edit comment" }).click();
  await dev.page.getByLabel("Edit comment").fill(`Looks right after all @${owner.username}`);
  await dev.page.getByRole("button", { name: "Save", exact: true }).click();
  const edited = dev.page.locator("li").filter({ hasText: "Looks right after all" });
  await expect(edited).toContainText("(edited)");

  // React, then un-react.
  await edited.getByRole("button", { name: "Add reaction" }).click();
  await edited.getByRole("button", { name: "React with 🎉" }).click();
  const reaction = edited.getByRole("button", { name: /^🎉 1, including you/ });
  await expect(reaction).toHaveAttribute("aria-pressed", "true");

  // Owner comments too; the developer cannot edit or delete it.
  await owner.page.goto(taskUrl);
  await owner.page.getByPlaceholder(/Write a comment/).fill("Owner note");
  await owner.page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(owner.page.locator("li").filter({ hasText: "Owner note" })).toBeVisible();

  await dev.page.reload();
  const ownerComment = dev.page.locator("li").filter({ hasText: "Owner note" });
  await expect(ownerComment).toBeVisible();
  await expect(ownerComment.getByRole("button", { name: /Edit comment|Delete comment/ })).toHaveCount(0);
  await expect(dev.page.locator("li").filter({ hasText: "Looks right after all" }).getByRole("button", { name: "🎉 1, including you. Remove your reaction" })).toBeVisible();

  // The owner (project manager) can moderate: delete the developer's comment.
  await owner.page.reload();
  await owner.page.locator("li").filter({ hasText: "Looks right after all" }).getByRole("button", { name: "Delete comment" }).click();
  await owner.page.getByRole("button", { name: "Delete comment" }).last().click();
  await expect(owner.page.locator("li").filter({ hasText: "Looks right after all" })).toHaveCount(0);

  // The mention notified the owner; opening it marks it read.
  await owner.page.goto("/dashboard");
  const bell = owner.page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName(/unread/);
  const before = Number((await bell.getAttribute("aria-label")).match(/(\d+) unread/)?.[1] ?? 0);
  await bell.click();
  await owner.page.getByRole("region", { name: "Notifications" }).getByRole("link", { name: /mentioned you/ }).first().click();
  await expect(owner.page).toHaveURL(new RegExp(task._id));
  await expect(owner.page.getByRole("button", { name: /^Notifications/ })).toHaveAccessibleName(
    before - 1 > 0 ? new RegExp(`${before - 1} unread`) : /^Notifications$/
  );

  await Promise.all([owner.context.close(), dev.context.close()]);
});

test("notes: a manager writes, a developer reads", async ({ browser }) => {
  const owner = await person(browser, "nown");
  const dev = await person(browser, "ndev");
  const project = await projectWith(owner, dev);
  const notesUrl = `/dashboard/projects/${project._id}?tab=notes`;

  await owner.page.goto(notesUrl);
  await owner.page.getByRole("button", { name: "New note" }).click();
  const dialog = owner.page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create note" }).click();
  await expect(dialog.getByText("Give the note a title.")).toBeVisible();
  await dialog.getByLabel("Title").fill("Release checklist");
  await dialog.getByLabel("Note").fill("1. Freeze\n2. Tag\n3. Ship");
  await dialog.getByRole("button", { name: "Create note" }).click();
  await expect(owner.page.getByRole("heading", { name: "Release checklist" })).toBeVisible();

  await owner.page.getByRole("button", { name: "Edit Release checklist" }).click();
  await owner.page.getByRole("dialog").getByLabel("Title").fill("Release checklist v2");
  await owner.page.getByRole("dialog").getByRole("button", { name: "Save note" }).click();
  await expect(owner.page.getByRole("heading", { name: "Release checklist v2" })).toBeVisible();

  await dev.page.goto(notesUrl);
  await expect(dev.page.getByRole("heading", { name: "Release checklist v2" })).toBeVisible();
  await expect(dev.page.getByText("3. Ship")).toBeVisible();
  await expect(dev.page.getByRole("button", { name: /New note|Edit |Delete / })).toHaveCount(0);

  await owner.page.getByRole("button", { name: "Delete Release checklist v2" }).click();
  await owner.page.getByRole("button", { name: "Delete note" }).click();
  await expect(owner.page.getByText("No notes yet")).toBeVisible();

  await Promise.all([owner.context.close(), dev.context.close()]);
});

test("sprint charts: burndown for the active sprint, velocity after one completes", async ({ browser }) => {
  const owner = await person(browser, "chart");
  const key = `S${unique().slice(-5)}`;
  const req = owner.page.request;
  const project = await json(await req.post(`${API}/projects`, { data: { name: `Charts ${key}`, key } }));
  const iso = (days) => new Date(Date.now() + days * 864e5).toISOString();

  // Sprint 1: 8 points, 5 done, then completed → velocity 5.
  const s1 = await json(await req.post(`${API}/projects/${project._id}/sprints`, { data: { name: "Sprint One", startDate: iso(0), endDate: iso(7) } }));
  const a = await json(await req.post(`${API}/tasks/${project._id}`, { data: { title: "A", storyPoints: 5, sprint: s1._id } }));
  await req.post(`${API}/tasks/${project._id}`, { data: { title: "B", storyPoints: 3, sprint: s1._id } });
  await req.post(`${API}/projects/${project._id}/sprints/${s1._id}/start`);
  await req.put(`${API}/tasks/${project._id}/t/${a._id}`, { data: { status: "done" } });
  await req.post(`${API}/projects/${project._id}/sprints/${s1._id}/complete`, { data: {} });

  // Sprint 2: active, 13 points, 2 done today.
  const s2 = await json(await req.post(`${API}/projects/${project._id}/sprints`, { data: { name: "Sprint Two", startDate: iso(0), endDate: iso(10) } }));
  const c = await json(await req.post(`${API}/tasks/${project._id}`, { data: { title: "C", storyPoints: 2, sprint: s2._id } }));
  await req.post(`${API}/tasks/${project._id}`, { data: { title: "D", storyPoints: 11, sprint: s2._id } });
  await req.post(`${API}/projects/${project._id}/sprints/${s2._id}/start`);
  await req.put(`${API}/tasks/${project._id}/t/${c._id}`, { data: { status: "done" } });

  await owner.page.goto(`/dashboard/projects/${project._id}?tab=sprints`);
  const burndown = owner.page.locator("figure").filter({ hasText: "Burndown, Sprint Two" });
  await expect(burndown).toContainText("11 of 13 points left");
  await expect(burndown.getByRole("img", { name: /11 of 13 story points left/ })).toBeVisible();

  // Keyboard reads the chart; the table shows the same numbers.
  await burndown.getByRole("img").focus();
  await expect(burndown.getByText("remaining", { exact: true })).toBeVisible();
  await burndown.getByText("Show data table").click();
  await expect(burndown.locator("table tbody tr").first()).toContainText("11");

  const velocity = owner.page.locator("figure").filter({ hasText: "Velocity" });
  await expect(velocity).toContainText("Average 5");
  await expect(velocity.getByRole("img", { name: "Sprint One: 5 points completed of 8 committed" })).toBeVisible();

  await owner.context.close();
});
