import { ApiError } from "../utils/api-errors.js";

/**
 * Response headers for a JSON API. Each one is here for a specific reason;
 * see docs/INTERVIEW_GUIDE.md §Security for the threat each one addresses.
 * (helmet would set these and more; most of the rest target HTML pages, which
 * this API does not serve apart from /api-docs.)
 */
export const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff"); // never sniff JSON as HTML/script
    res.setHeader("X-Frame-Options", "DENY"); // no clickjacking via <iframe>
    res.setHeader("Referrer-Policy", "no-referrer"); // URLs never leak to third parties
    if (req.path.startsWith("/api/")) {
        // API responses are data, never documents: forbid them from loading
        // anything or being framed if a browser ever renders one.
        res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    }
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains"); // HTTPS only
    }
    next();
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie authentication.
 *
 * Browsers attach cookies to cross-site requests, and in production the auth
 * cookies are SameSite=None (the SPA and API may live on different sites), so
 * a malicious page could make the victim's browser submit a state-changing
 * request. Two layers stop that:
 *  1. The API parses JSON bodies only. An HTML form cannot send
 *     application/json, and a script that tries to is subject to a CORS
 *     preflight, which an unlisted origin fails.
 *  2. This check: browsers always send an Origin header on cross-origin
 *     requests and scripts cannot forge it. A state-changing request from an
 *     origin that is not ours is rejected before it reaches any handler.
 * Requests with no Origin at all (curl, server-to-server, tests) are not
 * browser CSRF and are allowed; they still need a valid session cookie.
 */
export const requireTrustedOrigin = (allowedOrigins) => (req, res, next) => {
    const origin = req.get("Origin");
    if (SAFE_METHODS.has(req.method) || !origin || allowedOrigins.includes(origin)) return next();
    throw new ApiError(403, "Cross-site request rejected");
};
