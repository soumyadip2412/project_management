/**
 * FILE: frontend/src/components/landing/content.js
 * Shared constants for the public landing page (route "/").
 */

export const REPO_URL = "https://github.com/soumyadip2412/project_management";
// Swagger UI (/api-docs) is not served in production unless ENABLE_API_DOCS is
// set, so the public page links to the OpenAPI file in the repository instead.
export const API_SPEC_URL = `${REPO_URL}/blob/main/backend/docs/swagger.yaml`;
export const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * A demo deployment sets VITE_DEMO_LOGIN=true; the hero then offers
 * "Try the live demo", which opens /login?demo=1 with the demo account filled
 * in (see pages/Login.jsx). Everywhere else the same button reads "Sign in".
 */
export const DEMO_LOGIN_ENABLED = import.meta.env.VITE_DEMO_LOGIN === "true";
export const DEMO_ENTRY = DEMO_LOGIN_ENABLED
  ? { label: "Try the live demo", to: "/login?demo=1" }
  : { label: "Sign in", to: "/login" };

/** In-page sections, in navbar order. The ids are the anchor targets. */
export const SECTIONS = [
  { id: "product", label: "Product" },
  { id: "sprint-strip", label: "Sprint strip" },
  { id: "roles", label: "Roles" },
  { id: "security", label: "Security" },
  { id: "built", label: "How it's built" },
];
