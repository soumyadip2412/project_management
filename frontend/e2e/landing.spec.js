import { test, expect } from "@playwright/test";

/** The public landing page: reachable signed out, and its navigation works. */

const SECTIONS = [
  { id: "product", label: "Product" },
  { id: "sprint-strip", label: "Sprint strip" },
  { id: "roles", label: "Roles" },
  { id: "security", label: "Security" },
  { id: "built", label: "How it's built" },
];
const ROLES = ["Project manager", "Scrum master", "Developer", "QA", "Client / Viewer"];

const isDesktop = (page) => (page.viewportSize()?.width ?? 0) >= 1024;

test("landing sections exist and every navbar anchor scrolls to its section", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto("/");

  // Signed-out visitors stay on the landing page. The API client used to send
  // every failed session check to /login, which made "/" unreachable.
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("See sprint risk before it becomes a missed deadline.");

  // Every in-page target must exist.
  for (const { id } of SECTIONS) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }

  if (isDesktop(page)) {
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const { id, label } of SECTIONS) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      // Wait for smooth scroll to settle (two equal reads in a row; the order
      // jumps back up the page, so "already above 120px" is not enough), then
      // assert the section is in view and not hidden behind the sticky navbar.
      const section = page.locator(`#${id}`);
      let last = null;
      await expect
        .poll(
          async () => {
            const now = await section.evaluate((el) => Math.round(el.getBoundingClientRect().top));
            const settled = now === last;
            last = now;
            return settled ? now : NaN;
          },
          { timeout: 8000, intervals: [150] },
        )
        .toBeGreaterThan(-5);
      const top = await section.evaluate((el) => el.getBoundingClientRect().top);
      expect(top).toBeLessThan(120);
      const navBottom = await page.locator("header").first().evaluate((el) => el.getBoundingClientRect().bottom);
      expect(top).toBeGreaterThanOrEqual(navBottom - 1);
    }
  }

  // The navbar's account actions.
  if (isDesktop(page)) {
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
    await expect(header.getByRole("link", { name: "Create free account" })).toHaveAttribute("href", "/register");
  }

  // The API reference is the OpenAPI file in the repository (Swagger UI is
  // not served in production), opened in a new tab.
  const apiRef = page.locator("#built").getByRole("link", { name: /API reference/ });
  await expect(apiRef).toHaveAttribute("href", /\/backend\/docs\/swagger\.yaml$/);
  await expect(apiRef).toHaveAttribute("target", "_blank");

  // No dead footer links.
  const deadFooter = await page.locator('footer a[href="#"]').count();
  expect(deadFooter).toBe(0);

  // The landing page is public; the API is deliberately not running for this
  // check, so auth-bootstrap failures are expected noise.
  const real = consoleErrors.filter(
    (e) => !/401|Unauthorized|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(e),
  );
  expect(real).toEqual([]);
});

test("hero shows a real Board screenshot with alt text, and demo-off actions", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("#hero");
  const img = hero.locator("img:visible");
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("alt", /board/i);
  expect(await img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

  // E2E builds do not set VITE_DEMO_LOGIN, so the first action is a plain Sign in.
  await expect(hero.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
  await expect(hero.getByRole("link", { name: "Try the live demo" })).toHaveCount(0);
  await expect(hero.getByRole("link", { name: "Create free account" })).toHaveAttribute("href", "/register");
});

test("the sprint strip renders the app's SprintTide with sample data", async ({ page }) => {
  await page.goto("/");
  const strip = page.locator("#sprint-strip").getByRole("group", { name: /^Sprint 2, day 6 of 10/ });
  await expect(strip).toBeVisible();
  await expect(strip).toHaveAttribute("aria-label", /21 of 34 points left, 5 points added since the start, at risk/);
  await expect(strip.getByText("At risk", { exact: true })).toBeVisible();
});

test("product tabs switch with click and with arrow keys", async ({ page }) => {
  await page.goto("/");
  const tablist = page.getByRole("tablist", { name: "Product areas" });
  const tab = (name) => tablist.getByRole("tab", { name });
  const panel = page.locator("#product").getByRole("tabpanel");

  await expect(tab("Plan")).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("heading", { name: "Overcommit warning" })).toBeVisible();

  await tab("Review").click();
  await expect(tab("Review")).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("heading", { name: "Velocity" })).toBeVisible();
  await expect(panel.locator("img:visible")).toHaveAttribute("alt", /burndown/i);

  // Roving tabindex: arrows move selection and focus, and wrap around.
  await tab("Review").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tab("Track")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Track")).toBeFocused();
  await expect(panel.getByRole("heading", { name: "WIP limits" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tab("Plan")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Plan")).toBeFocused();
  await expect(tab("Track")).toHaveAttribute("tabindex", "-1");
});

test("the roles table has a header row and five role columns", async ({ page }) => {
  await page.goto("/");
  if (!isDesktop(page)) {
    // Phones get the same data as a list; the table is hidden there.
    const list = page.getByRole("list", { name: "What each project role can do" });
    await expect(list.getByRole("listitem")).toHaveCount(7);
    await expect(list.getByRole("listitem").first()).toContainText("Manage project members");
    await expect(list.getByRole("listitem").first()).toContainText("Project manager");
    return;
  }
  const table = page.getByRole("table", { name: "What each project role can do" });
  const header = table.getByRole("row").first();
  const columns = header.getByRole("columnheader");
  await expect(columns).toHaveText(["Capability", ...ROLES]);

  // Every cell has a text alternative; spot-check against permissions.js.
  const row = (name) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });
  await expect(row("Manage project members").getByRole("cell")).toHaveText(["Yes", "No", "No", "No", "No"]);
  await expect(row("Plan and run sprints").getByRole("cell")).toHaveText(["Yes", "Yes", "No", "No", "No"]);
  await expect(row("Create and edit issues").getByRole("cell")).toHaveText(["Yes", "Yes", "Yes", "Yes", "No"]);
  await expect(row("Comment on issues").getByRole("cell")).toHaveText(["Yes", "Yes", "Yes", "Yes", "Yes"]);
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("/login?demo=1 does not prefill unless VITE_DEMO_LOGIN is true", async ({ page }) => {
  await page.goto("/login?demo=1");
  await expect(page.getByPlaceholder("Enter your email address")).toHaveValue("");
  await expect(page.getByPlaceholder("Enter your password")).toHaveValue("");
  await expect(page.getByText("Demo account: these sign-in details are public.")).toHaveCount(0);
});

test("mobile menu exposes the same working links", async ({ page }) => {
  await page.goto("/");
  test.skip(isDesktop(page), "mobile-only");

  // dispatchEvent bypasses Playwright's hit-testing. Chromium's device
  // emulation reports a layout width wider than the visual viewport here, which
  // defeats the actionability check even though the button is genuinely on top.
  const toggle = page.getByRole("button", { name: "Menu" });
  await toggle.dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator("#mobile-menu");
  // Scoped to the menu: the footer repeats the same section links.
  for (const { id, label } of SECTIONS) {
    await expect(menu.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `#${id}`);
  }
  await expect(menu.getByRole("link", { name: "Create free account" })).toHaveAttribute("href", "/register");

  // Choosing a section closes the menu and scrolls to it.
  await menu.getByRole("link", { name: "Roles", exact: true }).dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveCount(0);
  await expect
    .poll(async () => await page.locator("#roles").evaluate((el) => Math.round(el.getBoundingClientRect().top)), {
      timeout: 8000,
    })
    .toBeLessThan(120);

  // Escape closes it too, and returns focus to the toggle.
  await toggle.dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});
