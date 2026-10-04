import { test, expect } from "@playwright/test";

/**
 * End-to-end verification of the critical path.
 *
 * Requires the E2E API running against an ephemeral MongoDB:
 *   cd backend && PORT=8123 npm run e2e:server
 *
 * The suite provisions its own user through the real registration UI, so it
 * needs no fixtures and never touches a shared database.
 *
 * Selectors use roles, accessible names and placeholders — what a user (or a
 * screen reader) sees — rather than test ids.
 *
 * Navigation goes through `navTo()`: the sidebar entries are links, and below
 * 1024px they live in a drawer opened from the top bar, so on the mobile
 * project the helper opens the drawer first, exactly as a person would.
 */

const unique = () => Date.now().toString().slice(-9);
const PASSWORD = "Password123!";

/** Collects console and network problems so every test can assert on them. */
function watchForProblems(page) {
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // 401s are expected: the app probes the session on load and after logout,
    // and the client retries once through /auth/refresh-token.
    if (msg.text().includes("401")) return;
    consoleErrors.push(msg.text());
  });
  page.on("response", (res) => {
    // 401 is expected before login and during logout; anything else is not.
    if (res.status() >= 400 && res.status() !== 401) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });

  return { consoleErrors, failedRequests };
}

async function register(page) {
  const id = unique();
  const account = { email: `e2e${id}@example.com`, fullName: `E2E User ${id}` };

  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(account.fullName);
  await page.getByPlaceholder("john@example.com").fill(account.email);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  return account;
}

async function login(page, account) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email address").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign In/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

async function createProject(page, name, key) {
  await navTo(page, "Projects");
  await expect(page).toHaveURL(/\/dashboard\/projects/);

  // Two "New project" buttons exist (top bar + page header), so .first() avoids
  // a strict-mode violation.
  await page.getByRole("button", { name: /New Project/i }).first().click();

  const nameField = page.getByPlaceholder("e.g. NextGen Web Engine");
  await expect(nameField, "the create-project modal should open").toBeVisible();

  // Scope to the dialog's form: the Projects page behind it also renders a
  // "Create project" button (its empty state).
  const form = page.getByRole("dialog").locator("form").filter({ has: nameField });

  await nameField.fill(name);
  // exact: true is required — getByPlaceholder substring-matches, and "e.g. NEXT"
  // is also a substring of "e.g. NextGen Web Engine".
  await form.getByPlaceholder("e.g. NEXT", { exact: true }).fill(key);
  await form.getByPlaceholder("What is the goal of this project?").fill("Created by the E2E suite.");
  await form.getByRole("button", { name: /Create Project/i }).click();

  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
}

async function createTask(page, title) {
  await navTo(page, "Tasks");
  await expect(page).toHaveURL(/\/dashboard\/tasks/);

  await page.getByRole("button", { name: /New Task/i }).first().click();

  const titleField = page.getByPlaceholder("e.g. Implement OAuth token exchange");
  await expect(titleField, "the create-task modal should open").toBeVisible();

  const form = page.getByRole("dialog").locator("form").filter({ has: titleField });
  await titleField.fill(title);
  await form.getByRole("button", { name: /Create Task/i }).click();

  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
}

/** The sidebar, whether docked (desktop) or in the drawer (mobile). */
const sidebar = (page) => page.getByRole("complementary", { name: "Main navigation" });

/** Opens the mobile drawer if the sidebar is not already on screen. */
async function ensureSidebar(page) {
  // Wait for the app shell: right after sign-in the session check may still be
  // running, and isVisible() below does not wait.
  await expect(page.locator("main#main")).toBeVisible({ timeout: 20_000 });
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await expect(sidebar(page)).toBeInViewport();
}

async function navTo(page, name) {
  await ensureSidebar(page);
  await sidebar(page).getByRole("link", { name, exact: true }).click();
}

async function logout(page) {
  await ensureSidebar(page);
  await sidebar(page).getByRole("button", { name: "Log out" }).click();
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("critical path", () => {
  test("register → dashboard, then log out and log back in", async ({ page }) => {
    const problems = watchForProblems(page);

    const account = await register(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);

    // Log out, then confirm the session is really gone.
    await logout(page);
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 20_000 });

    await login(page, account);
    await ensureSidebar(page);
    await expect(sidebar(page).getByRole("link", { name: "Projects", exact: true })).toBeVisible();

    expect(problems.consoleErrors, `console errors:\n${problems.consoleErrors.join("\n")}`).toEqual([]);
  });

  test("workspace → project → task, and the data persists across reload", async ({ page }) => {
    const problems = watchForProblems(page);
    await register(page);

    // Workspaces view loads (a default workspace is created server-side on signup flow).
    await navTo(page, "Workspaces");
    await expect(page).toHaveURL(/\/dashboard\/workspaces/);

    const id = unique();
    const projectName = `E2E Project ${id}`;
    await createProject(page, projectName, `E${id.slice(-4)}`);

    const taskTitle = `E2E Task ${id}`;
    await createTask(page, taskTitle);

    // Reload proves it was persisted, not just held in component state.
    await page.reload();
    await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 20_000 });

    expect(problems.failedRequests, `failed requests:\n${problems.failedRequests.join("\n")}`).toEqual([]);
  });

  /**
   * The P0.2 regression test. Every canonical status must be a reachable board
   * column and must persist. Previously the board offered a "review" column
   * whose value the backend enum rejected with a 400.
   */
  test("board shows every canonical status, and a status change persists", async ({ page }) => {
    const problems = watchForProblems(page);
    await register(page);

    const id = unique();
    await createProject(page, `Board Project ${id}`, `B${id.slice(-4)}`);
    const taskTitle = `Board Task ${id}`;
    await createTask(page, taskTitle);

    // All seven columns are present — including Backlog and Cancelled, which the
    // board used to omit entirely, hiding any task holding those statuses.
    // A phone shows one column at a time, chosen from a picker, so there every
    // status must be one of the picker's options instead.
    const statuses = ["Backlog", "To Do", "In Progress", "In Review", "QA Testing", "Done", "Cancelled"];
    const picker = page.getByLabel("Column");
    if (await picker.isVisible()) {
      const options = await picker.locator("option").allTextContents();
      for (const column of statuses) expect(options.some((o) => o.startsWith(`${column} (`))).toBe(true);
    } else {
      for (const column of statuses) {
        await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
      }
    }

    // Open the task. On the detail page the status <select> is unambiguous —
    // on the Tasks page a status *filter* carries the same option labels.
    await page.getByText(taskTitle).first().click();
    await expect(page).toHaveURL(/\/dashboard\/tasks\//, { timeout: 20_000 });

    const statusSelect = page.locator("select").filter({ hasText: "QA Testing" }).first();
    await expect(statusSelect).toBeVisible();

    // This is the exact transition that used to fail: the board sent "review",
    // which the schema enum rejects, so the API returned 400.
    await statusSelect.selectOption("in_review");
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Reload proves the server accepted and stored it.
    await page.reload();
    await expect(
      page.locator("select").filter({ hasText: "QA Testing" }).first()
    ).toHaveValue("in_review");

    const statusFailures = problems.failedRequests.filter((r) => r.includes("/tasks/"));
    expect(statusFailures, `task request failures:` + statusFailures.join(", ")).toEqual([]);
  });

  test("filters and search render without errors", async ({ page }) => {
    const problems = watchForProblems(page);
    await register(page);

    const id = unique();
    await createProject(page, `Filter Project ${id}`, `F${id.slice(-4)}`);
    await createTask(page, `Filter Task ${id}`);

    // The status filter is only rendered in list view.
    await page.getByRole("button", { name: /^List$/i }).click();

    const filter = page.getByRole("combobox", { name: "Status", exact: true });
    await expect(filter).toBeVisible();
    await filter.selectOption("in_review");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await filter.selectOption("all");

    // Global search box (currently a client-side filter — audit D5).
    const search = page.getByPlaceholder(/Search projects, tasks/i);
    await search.fill("Filter");
    await expect(search).toHaveValue("Filter");

    expect(problems.consoleErrors, `console errors:\n${problems.consoleErrors.join("\n")}`).toEqual([]);
  });
});

test.describe("authorization", () => {
  test("dashboard routes are unreachable when logged out", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/projects", "/dashboard/tasks", "/dashboard/settings"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect to /login`).toHaveURL(/\/login/, { timeout: 20_000 });
    }
  });

  test("a corrupted access cookie is recovered through the refresh cookie", async ({ page }) => {
    const account = await register(page);
    await login(page, account);

    // The session lives in httpOnly cookies, out of reach of page scripts.
    // Corrupt the access cookie from the test harness, then force a fetch: the
    // client must refresh the session through the (still valid) refresh
    // cookie and carry on — never hang (audit D9), never bounce to /login.
    const cookies = await page.context().cookies();
    const access = cookies.find((c) => c.name === "accessToken");
    expect(access, "access token must be an httpOnly cookie").toBeTruthy();
    expect(access.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("accessToken");

    await page.context().addCookies([{ ...access, value: "not-a-real-token" }]);
    await navTo(page, "Projects");

    await expect(page).toHaveURL(/\/dashboard\/projects/, { timeout: 25_000 });
    await expect(page.getByText("Session expired")).toHaveCount(0);
  });
});
