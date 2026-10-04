import { test, expect } from "@playwright/test";

/** The public landing page: reachable signed out, and its navigation works. */

const SECTIONS = ["features", "architecture", "security"];

test("landing sections exist and anchors scroll to them", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto("/");

  // Signed-out visitors stay on the landing page. The API client used to send
  // every failed session check to /login, which made "/" unreachable.
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/$/);

  // Every in-page target must exist.
  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }

  const isDesktop = (page.viewportSize()?.width ?? 0) >= 768;

  if (isDesktop) {
    for (const id of SECTIONS) {
      const label = id[0].toUpperCase() + id.slice(1);
      await page.locator("nav").getByRole("link", { name: label, exact: true }).click();
      // Wait for smooth scroll to settle, then assert the section is in view
      // and not hidden behind the 68px fixed navbar.
      await expect
        .poll(
          async () =>
            await page.locator(`#${id}`).evaluate((el) => Math.round(el.getBoundingClientRect().top)),
          { timeout: 8000 },
        )
        .toBeLessThan(120);

      const top = await page
        .locator(`#${id}`)
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(top).toBeGreaterThan(-5);
    }
  }

  // Documentation must point at the backend Swagger UI in a new tab.
  const docs = page.locator("nav").getByRole("link", { name: "Documentation", exact: true });
  if (isDesktop) {
    await expect(docs).toHaveAttribute("href", /\/api-docs$/);
    await expect(docs).toHaveAttribute("target", "_blank");
  }

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

test("mobile menu exposes the same working links", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 0) < 768;
  test.skip(!isMobile, "mobile-only");

  // dispatchEvent bypasses Playwright's hit-testing. Chromium's device
  // emulation reports a layout width wider than the visual viewport here, which
  // defeats the actionability check even though the button is genuinely on top.
  const toggle = page.getByRole("button", { name: "Menu" });
  await toggle.dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  // Scoped to the menu: the footer repeats the same section links.
  for (const id of SECTIONS) {
    const label = id[0].toUpperCase() + id.slice(1);
    await expect(page.locator("#mobile-menu").getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "href",
      `#${id}`,
    );
  }
});
