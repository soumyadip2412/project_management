import { test, expect } from "@playwright/test";

/**
 * The task board: a card can be moved with a mouse drag, with the keyboard and
 * with its "Move to…" menu (the only way on a phone, which shows one column at
 * a time), and every move survives a reload.
 */

const API = "http://localhost:8123/api/v1"; // matches VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const unique = () => Date.now().toString().slice(-9);

/** Registers through the UI, then creates a project and one To Do task through the API. */
async function setup(page) {
  const id = unique();
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(`Board User ${id}`);
  await page.getByPlaceholder("john@example.com").fill(`board${id}@example.com`);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // page.request shares the browser context's session cookies.
  const project = (await (await page.request.post(`${API}/projects`, { data: { name: `Board ${id}`, key: `B${id.slice(-5)}` } })).json()).data;
  const task = (await (await page.request.post(`${API}/tasks/${project._id}`, { data: { title: "Move me around", status: "todo" } })).json()).data;
  await page.goto(`/dashboard/tasks?project=${project._id}`);
  return task;
}

const column = (page, label) => page.locator(`section[aria-label^="${label},"]`);
const card = (page, key) => page.locator(`[data-card]`).filter({ hasText: key });

test("desktop: mouse drag, keyboard and menu all move a card, and the move persists", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop board");
  const task = await setup(page);
  await expect(column(page, "To Do")).toContainText(task.issueKey);

  // Mouse drag To Do → In Progress
  const from = await card(page, task.issueKey).boundingBox();
  const to = await column(page, "In Progress").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
  await page.mouse.up();
  await expect(column(page, "In Progress")).toContainText(task.issueKey);
  await expect(page).toHaveURL(/\/dashboard\/tasks/); // the drag did not open the task

  // Keyboard In Progress → In Review: Space, →, Space. Each step waits for the
  // screen-reader announcement, as a keyboard user would; keys pressed before
  // the drag has started are ignored.
  const announced = page.locator('[id^="DndLiveRegion"]');
  await card(page, task.issueKey).getByRole("link").focus();
  await page.keyboard.press("Space");
  // The announcement goes "Picked up …" then straight to "… is over In Progress".
  await expect(announced).toContainText(/Picked up|is over In Progress/);
  await page.keyboard.press("ArrowRight");
  await expect(announced).toContainText("is over In Review");
  await page.keyboard.press("Space");
  await expect(column(page, "In Review")).toContainText(task.issueKey);
  await expect(card(page, task.issueKey).getByRole("link")).toBeFocused();

  // Menu → Done
  await page.getByRole("button", { name: `Move ${task.issueKey}` }).click();
  await page.getByRole("menuitem", { name: "Move to Done" }).click();
  await expect(column(page, "Done")).toContainText(task.issueKey);

  await page.reload();
  await expect(column(page, "Done")).toContainText(task.issueKey);

  // A plain click still opens the task.
  await card(page, task.issueKey).getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/tasks\/[a-f0-9]{24}/);
});

test("phone: one column at a time, cards move with the menu", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone board");
  const task = await setup(page);

  const picker = page.getByLabel("Column");
  await expect(picker).toHaveValue("todo");
  await expect(page.locator("section[aria-label]")).toHaveCount(1);
  await expect(column(page, "To Do")).toContainText(task.issueKey);

  await page.getByRole("button", { name: `Move ${task.issueKey}` }).click();
  await page.getByRole("menuitem", { name: "Move to QA Testing" }).click();
  await expect(column(page, "To Do")).not.toContainText(task.issueKey);

  await picker.selectOption("qa_testing");
  await expect(column(page, "QA Testing")).toContainText(task.issueKey);

  await page.reload();
  await page.getByLabel("Column").selectOption("qa_testing");
  await expect(column(page, "QA Testing")).toContainText(task.issueKey);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
