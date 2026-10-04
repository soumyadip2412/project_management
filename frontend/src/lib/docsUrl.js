/**
 * The backend serves Swagger UI at `/api-docs`, which sits *outside* the
 * `/api/v1` prefix that `VITE_API_BASE_URL` points at. Derive the docs origin
 * from the same env var so it follows the API across environments.
 */
export function docsUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  try {
    return new URL("/api-docs", base).toString();
  } catch {
    return "http://localhost:8000/api-docs";
  }
}
