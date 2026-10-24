// ─── ProjectCamp API Client ──────────────────────────────────────────────────
/**
 * FILE: frontend/src/lib/api.js
 *
 * PURPOSE
 *   The ONE place the frontend talks to the backend. Components never call
 *   fetch() directly; they use:
 *     api.get(url, { params })   api.post(url, body)   api.put(url, body)
 *     api.patch(url, body)       api.delete(url)
 *   Each call resolves to the parsed JSON body ({ statusCode, data, message, success })
 *   or throws an ApiError with statusCode, message and field errors.
 *
 * WHAT IT HANDLES FOR EVERY REQUEST
 *   1. Builds the URL: BASE_URL (VITE_API_BASE_URL from .env) + endpoint + ?params
 *   2. Sends JSON, with credentials: "include" so the browser attaches the auth cookies
 *   3. Parses JSON (or text) responses
 *   4. Silent session refresh on 401 (see the diagram below)
 *   5. Converts non-2xx responses into a thrown ApiError
 *
 * 401 HANDLING (an interview favourite)
 *   request → 401 → is a refresh already running?
 *      no  → isRefreshing = true → POST /auth/refresh-token
 *              ok   → wake queued requests (true) → retry this request once
 *              fail → wake queued requests (false) → if on /dashboard go to /login → throw
 *      yes → queue this request; when the refresh finishes, retry it or reject
 *   This guarantees that 10 parallel requests failing with 401 cause ONE refresh,
 *   not 10. Concurrent refreshes would trip the backend's refresh-token reuse
 *   detection and log the user out.
 *   `_isRetry` makes sure a request is retried at most once (no infinite loop).
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// The error type every failed call throws. Pages read err.message for the UI
// and err.statusCode to branch (e.g. 404 → "not found" state).
export class ApiError extends Error {
  statusCode;
  errors;

  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// ─── Session Refresh Logic ───────────────────────────────────────────────────
// Auth is cookie-only: the access and refresh tokens live in httpOnly cookies
// that JavaScript cannot read (so an XSS bug cannot steal them). This client
// never sees a token; it only reacts to 401s by asking the server to refresh
// the cookies, then retries once.
let isRefreshing = false;
// Requests that hit 401 while a refresh is already running wait here, and are
// told whether it worked, so they neither hang nor start a second refresh.
let refreshSubscribers = [];

function notifyRefreshSubscribers(ok) {
  // Swap the queue out before invoking, so a callback that itself queues a
  // request is not dropped by the reset below.
  const subscribers = refreshSubscribers;
  refreshSubscribers = [];
  subscribers.forEach((cb) => cb(ok));
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

async function refreshSession() {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: "POST",
      credentials: "include", // sends the httpOnly refreshToken cookie
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Core Request Function ───────────────────────────────────────────────────
/**
 * @param {string} endpoint  "/projects" (relative to BASE_URL) or a full URL
 * @param {object} options   fetch options plus { params } (query string object)
 *                           and the internal `_isRetry` flag
 */
async function request(endpoint, options = {}) {
  // Pull out our custom options; everything else (method, body, ...) goes to fetch.
  const { params, headers = {}, _isRetry, ...customConfig } = options;

  let url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  // { status: "todo", page: 2, sprint: undefined } → "?status=todo&page=2"
  // (undefined/null values are skipped; URLSearchParams handles encoding).
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  const config = {
    method: "GET",
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    credentials: "include", // the session cookies are the only credential
    ...customConfig,
  };

  const response = await fetch(url, config);

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // ─── 401 Auto-Refresh: refresh the session cookies, retry once ─────────
  // Not for /auth/login (a 401 there means wrong password, not an expired
  // session) and not for the refresh call itself (that would recurse).
  if (response.status === 401 && !_isRetry && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/refresh-token")) {
    if (!isRefreshing) {
      isRefreshing = true;
      const refreshed = await refreshSession();
      isRefreshing = false;

      if (refreshed) {
        notifyRefreshSubscribers(true);
        // Retry the original request; the browser now sends the new cookie.
        return request(endpoint, { ...options, _isRetry: true });
      } else {
        // Refresh failed — the session is over; go to login
        notifyRefreshSubscribers(false);
        // Only the app shell requires a session. Public pages (landing, login,
        // register, reset-password, verify-email) must stay usable when logged out.
        if (window.location.pathname.startsWith("/dashboard")) {
          window.location.href = "/login";
        }
        throw new ApiError(401, "Session expired. Please log in again.");
      }
    } else {
      // Another request is already refreshing — queue this one
      return new Promise((resolve, reject) => {
        addRefreshSubscriber((ok) => {
          if (ok) {
            resolve(request(endpoint, { ...options, _isRetry: true }));
          } else {
            reject(new ApiError(401, "Session expired. Please log in again."));
          }
        });
      });
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.errors?.[0] || response.statusText || "Request failed";
    throw new ApiError(response.status, message, data?.errors || []);
  }

  return data;
}

// Thin verb helpers. Bodies are JSON-encoded here, matching the backend's
// JSON-only body parser.
export const api = {
  get: (url, options) => 
    request(url, { ...options, method: "GET" }),

  post: (url, body, options) => 
    request(url, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),

  put: (url, body, options) => 
    request(url, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),

  patch: (url, body, options) => 
    request(url, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),

  delete: (url, options) => 
    request(url, { ...options, method: "DELETE" }),
};
