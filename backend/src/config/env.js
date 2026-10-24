/**
 * FILE: backend/src/config/env.js
 *
 * PURPOSE
 *   Loads `.env` into process.env and validates the configuration ONCE, at
 *   import time. If anything essential is missing, the process prints the
 *   problems and exits with code 1 ("fail fast").
 *
 * WHERE IT FITS
 *   It is the very first import of both index.js and app.js. Because ES
 *   modules evaluate imports in order, every later module (JWT signing,
 *   database, mail) can assume the configuration is valid.
 *
 * RULES ENFORCED
 *   Always:          ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET must exist.
 *   In production:   MONGO_URL and CORS_ORIGIN must exist; the two secrets must
 *                    differ and each be at least 32 characters long.
 *   Defaults:        ACCESS_TOKEN_EXPIRY=15m, REFRESH_TOKEN_EXPIRY=7d.
 *
 * INTERVIEW NOTES
 *   Q: What is JWT?
 *   A: JSON Web Token. A compact, URL-safe string that encodes a JSON object
 *      and is signed with a secret. The server can verify the signature to
 *      ensure the token was issued by itself and not tampered with.
 *  Q: Why is a refresh token long-lived and an access token short-lived?   
 *  A: The access token is sent with every request, so it is more likely to be
    * stolen. A stolen access token is only useful for a few minutes, while a
    * stolen refresh token is useful for days. The client can silently refresh
    * the access token using the refresh token, so the user does not have to log
    * in again.
 * Q. Why is the refresh token stored in an httpOnly cookie?
 * A: An httpOnly cookie is not accessible to JavaScript, so a stolen XSS
 * script cannot read it. The cookie is sent automatically with every request
 * to the server, so the client does not have to store it in localStorage or
 * send it manually.
 *   Q. Why is the refresh token sent in a cookie instead of the Authorization header?
 *   A: Cookies are sent automatically with every request to the server, so the
 *      client does not have to store it in localStorage or send it manually.
 *      The cookie is also httpOnly, so it is not accessible to JavaScript and
 *      cannot be stolen by a XSS attack.
 *   Q. Why is the access token sent in the Authorization header instead of a cookie?
 *   A: The access token is short-lived and is sent with every request, so it is
 *      more likely to be stolen. If it were sent in a cookie, it would be sent
 *      automatically with every request, even to third-party sites, which could
 *      steal it. By sending it in the Authorization header, the client can
 *      control when it is sent and to which server.
 *   Q.Difference between access and refresh tokens?
 *   A: Access tokens are short-lived and are used to access protected resources.
 *      Refresh tokens are long-lived and are used to obtain new access tokens.   
 *   Q: Why must the access and refresh secrets differ?
 *   A: Both are JWTs. With the same secret, a long-lived refresh token would
 *      also pass verification as an access token, which defeats the point
 *      of a short-lived access token.
 *   Q: Why validate at startup instead of when a value is first used?
 *   A: A misconfigured server should refuse to start. Failing on the first
 *      login in production is much worse.
 */
import dotenv from "dotenv";
// Reads KEY=value lines from backend/.env (relative to the working directory)
// into process.env. Values already set in the real environment win.
dotenv.config({ path: "./.env" });

/**
 * Validates configuration once, at startup, and fails fast.
 * A server that boots with a missing secret or a token without an expiry is
 * worse than one that refuses to start.
 */
const DEFAULTS = {
    // Short-lived access token: a stolen one is useful for minutes, not days.
    // The client refreshes silently using the long-lived, httpOnly refresh cookie.
    ACCESS_TOKEN_EXPIRY: "15m",
    REFRESH_TOKEN_EXPIRY: "7d",
};

/**
 * Applies defaults, then collects every configuration problem and exits if
 * there are any. All problems are listed together so they can be fixed in one go.
 * Exported so it can be called on its own; it also runs once at the bottom of this file.
 */
export const validateEnv = () => {
    const isProduction = process.env.NODE_ENV === "production";

    // `||=` assigns only when the current value is falsy (unset or "").
    for (const [key, value] of Object.entries(DEFAULTS)) {
        process.env[key] ||= value;
    }

    const required = ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
    if (isProduction) required.push("MONGO_URL", "CORS_ORIGIN");

    const problems = required.filter((key) => !process.env[key]).map((key) => `${key} is missing`);

    // With one shared secret, a (long-lived) refresh token would also verify as
    // an access token. Fatal in production; a loud warning elsewhere so an
    // existing development .env keeps working until it is rotated.
    if (process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
        const message = "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must differ";
        if (isProduction) problems.push(message);
        else console.warn(`CONFIG WARNING: ${message} (a refresh token is currently accepted as an access token)`);
    }
    // Short HMAC secrets can be brute-forced offline from any captured token.
    // ?? is used to treat undefined as "" so that the length check works even if the variable is missing.
    if (isProduction) {
        for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
            if ((process.env[key] ?? "").length < 32) problems.push(`${key} must be at least 32 characters in production`);
        }
    }

    if (problems.length > 0) {
        // The logger is not configured yet at this point, so use the console.
        console.error(`FATAL CONFIG ERROR:\n  - ${problems.join("\n  - ")}`);
        process.exit(1);
    }
};

// Runs on import: simply importing this module validates the configuration.
validateEnv();


// this env.js file is imported by index.js and app.js, so any module that imports either of those two files will also import this file and validate the configuration. This ensures that the configuration is validated before any other module is loaded, and that any problems are reported immediately.
// This is used mainly for the JWT signing, database, and mail modules, which all require valid configuration to function correctly. If any of those modules are imported before the configuration is validated, they may fail to initialize correctly and cause runtime errors. By validating the configuration at import time, we can catch any problems early and prevent them from causing issues later on. 
// This is very important in production, where a misconfigured server can cause downtime and lost revenue. By failing fast and reporting configuration problems immediately, we can ensure that the server is always running with valid configuration and avoid any potential issues.