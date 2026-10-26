import { expect } from "@playwright/test";

/**
 * Sign-up as a user does it: fill the form, see "Check your inbox", open the
 * emailed verification link, then sign in. Login is refused until the email is
 * verified, so every spec that needs a fresh account goes through here.
 *
 * The E2E server keeps every email it sends and exposes the newest one per
 * address at /__e2e/last-email (backend/scripts/e2e-server.mjs).
 */

export const API_ORIGIN = "http://localhost:8123"; // must match VITE_API_BASE_URL in .env.e2e

/** Path of the newest `kind` link emailed to `to`, waiting for it to arrive. */
export async function emailedLink(request, to, kind, { not } = {}) {
  const pattern = new RegExp(String.raw`https?://[^\s/]+(/auth/${kind}/[A-Za-z0-9]+)`);
  let path;
  await expect
    .poll(
      async () => {
        const res = await request.get(`${API_ORIGIN}/__e2e/last-email`, { params: { to } });
        if (!res.ok()) return undefined;
        path = (await res.json()).text.match(pattern)?.[1];
        return path && path !== not ? path : undefined;
      },
      { message: `waiting for a ${kind} email to ${to}`, timeout: 10_000 }
    )
    .toBeTruthy();
  return path;
}

/** Fills and submits the sign-up form, ending on the "Check your inbox" screen. */
export async function submitSignUp(page, { fullName, email, password }) {
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(fullName);
  await page.getByPlaceholder("john@example.com").fill(email);
  await page.getByPlaceholder("Create a password").fill(password);
  await page.getByPlaceholder("Confirm your password").fill(password);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible({ timeout: 20_000 });
}

/** Sign up, verify through the emailed link, sign in, and land on the dashboard. */
export async function signUpAndSignIn(page, account) {
  await submitSignUp(page, account);

  await page.goto(await emailedLink(page.request, account.email, "verify-email"));
  await expect(page.getByText("Your email address is verified.")).toBeVisible();

  await page.goto("/login");
  await page.getByPlaceholder("Enter your email address").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(account.password);
  await page.getByRole("button", { name: /^Sign In/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}
