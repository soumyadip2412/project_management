import { test, expect } from "@playwright/test";
import { emailedLink, signUpAndSignIn, submitSignUp } from "./signup.js";

/**
 * The two flows that start in an email: verifying the address and resetting a
 * forgotten password. Both used to dead-end (the reset link hit a missing route,
 * the verify link opened the API's raw JSON).
 *
 * The E2E server keeps every email it sends and exposes the newest one per
 * address at /__e2e/last-email (scripts/e2e-server.mjs), so these tests follow
 * the same link a user would click.
 */

const PASSWORD = "Password123!";
const unique = () => Date.now().toString().slice(-9);

async function register(page) {
  const id = unique();
  const account = { email: `links${id}@example.com`, fullName: `Links User ${id}` };
  await signUpAndSignIn(page, { fullName: account.fullName, email: account.email, password: PASSWORD });
  return account;
}

async function signIn(page, email, password) {
  await page.getByPlaceholder("Enter your email address").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /^Sign In/i }).click();
}

test("email verification: sign-in waits for the emailed link, and the sign-in page can resend it", async ({ page, request }) => {
  const id = unique();
  const account = { email: `verify${id}@example.com`, fullName: `Verify User ${id}`, password: PASSWORD };
  await submitSignUp(page, account);
  await expect(page.getByText(account.email)).toBeVisible();
  const first = await emailedLink(request, account.email, "verify-email");

  // Signing in before verifying is refused, with a way to get a new link.
  await page.goto("/login");
  await signIn(page, account.email, PASSWORD);
  await expect(page.getByText("Please verify your email first.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Resend the verification email" }).click();
  await expect(page.getByText("A new link is on its way.", { exact: false })).toBeVisible();
  const second = await emailedLink(request, account.email, "verify-email", { not: first });

  // The superseded link is rejected with a readable message, not JSON.
  await page.goto(first);
  await expect(page.getByText(/invalid, has expired or was already used/)).toBeVisible();

  await page.goto(second);
  await expect(page.getByText("Your email address is verified.")).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await signIn(page, account.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/dashboard/settings");
  await expect(page.getByLabel("Full name")).toHaveValue(account.fullName);
  await expect(page.getByText("Your email address is not verified yet.")).toHaveCount(0);
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

  // The current password cannot be chosen again; the link stays usable.
  await page.getByPlaceholder("Create a password").fill(PASSWORD);
  await page.getByPlaceholder("Repeat the password").fill(PASSWORD);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("must be different from your current password", { exact: false })).toBeVisible();

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
