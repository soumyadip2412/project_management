import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * The API is NOT started here — run it separately, because it needs an ephemeral
 * MongoDB (the configured Atlas cluster must never receive test data):
 *
 *   cd backend && PORT=8123 npm run e2e:server
 *   cd frontend && npm run e2e
 *
 * Only the Vite dev server is managed automatically.
 */
const FRONTEND_PORT = 5199;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // flows share a backing database
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    // `--mode e2e` loads .env.e2e, which pins VITE_API_BASE_URL to the ephemeral
    // API. Passing the variable through `env` here does NOT work: Vite's .env
    // files take precedence, and the committed .env points at :8000 — where a
    // real backend may be listening.
    command: `npx vite --port ${FRONTEND_PORT} --strictPort --mode e2e`,
    url: `http://localhost:${FRONTEND_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
