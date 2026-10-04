import { test, expect } from "@playwright/test";

/**
 * The two flows that start in an email: verifying the address and resetting a
 * forgotten password. Both used to dead-end (the reset link hit a missing route,
 * the verify link opened the API's raw JSON).
 *
 * The E2E server keeps every email it sends and exposes the newest one per
 * address at /__e2e/last-email (scripts/e2e-server.mjs), so these tests follow
 * the same link a user would click.
 */

const API_ORIGIN = "http://localhost:8123"; // must match VITE_API_BASE_URL in .env.e2e
const PASSWORD = "Password123!";
const unique = () => Date.now().toString().slice(-9);

/** Path of the newest `kind` link emailed to `to`, waiting for it to arrive. */
async function emailedLink(request, to, kind, { not } = {}) {
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

async function register(page) {
  const id = unique();
  const account = { email: `links${id}@example.com`, fullName: `Links User ${id}` };
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(account.fullName);
  await page.getByPlaceholder("john@example.com").fill(account.email);
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Confirm your password").fill(PASSWORD);
  await page.getByRole("button", { name: /Create Account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  return account;
}

async function signIn(page, email, password) {
  await page.getByPlaceholder("Enter your email address").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /^Sign In/i }).click();
}

test("email verification: the emailed link verifies the account, and Settings can resend it", async ({ page, request }) => {
  const account = await register(page);
  const first = await emailedLink(request, account.email, "verify-email");

  // Unverified accounts are told so in Settings, and can ask for a new link.
  await page.goto("/dashboard/settings");
  const notice = page.getByText("Your email address is not verified yet.");
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByText("Verification email sent")).toBeVisible();
  const second = await emailedLink(request, account.email, "verify-email", { not: first });

  // The superseded link is rejected with a readable message, not JSON.
  await page.goto(first);
  await expect(page.getByText(/invalid, has expired or was already used/)).toBeVisible();

  await page.goto(second);
  await expect(page.getByText("Your email address is verified.")).toBeVisible();
  await page.getByRole("link", { name: "Go to the dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/settings");
  await expect(page.getByLabel("Full name")).toHaveValue(account.fullName);
  await expect(notice).toHaveCount(0);
});

test("password reset: request → emailed link → new password → sign in", async ({ browser, request }) => {
  // A fresh, signed-out browser context: the person who forgot their password.
  const setup = await browser.newContext();
  const account = await register(await setup.newPage());
  await setup.close();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByPlaceholder("Enter your registered email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/we have sent it a link to reset the password/)).toBeVisible();

  const link = await emailedLink(request, account.email, "reset-password");
  await page.goto(link);
  await expect(page).toHaveURL(link); // a public page: no bounce to /login
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  // Client-side checks run before anything is sent.
  await page.getByPlaceholder("Create a password").fill("NewPassword456");
  await page.getByPlaceholder("Repeat the password").fill("Different456");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("The passwords do not match.")).toBeVisible();

  await page.getByPlaceholder("Repeat the password").fill("NewPassword456");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Your password has been reset.")).toBeVisible();

  // The old password no longer works; the new one does.
  await signIn(page, account.email, PASSWORD);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByPlaceholder("Enter your password").fill("NewPassword456");
  await page.getByRole("button", { name: /^Sign In/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // The link is single-use.
  await page.goto(link);
  await page.getByPlaceholder("Create a password").fill("Another789");
  await page.getByPlaceholder("Repeat the password").fill("Another789");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText(/This reset link is invalid or has expired/)).toBeVisible();

  await context.close();
});
