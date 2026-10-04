import dotenv from "dotenv";
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

export const validateEnv = () => {
    const isProduction = process.env.NODE_ENV === "production";

    for (const [key, value] of Object.entries(DEFAULTS)) {
        process.env[key] ||= value;
    }

    const required = ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
    if (isProduction) required.push("MONGO_URL", "CORS_ORIGIN");

    const problems = required.filter((key) => !process.env[key]).map((key) => `${key} is missing`);

    // With one shared secret, a (long-lived) refresh token would also verify as
    // an access token. Fatal in production; a loud warning elsewhere so an
    // existing development .env keeps working until it is rotated.
    if (process.env.ACCESS_TOKEN_SECRET && process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
        const message = "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must differ";
        if (isProduction) problems.push(message);
        else console.warn(`CONFIG WARNING: ${message} (a refresh token is currently accepted as an access token)`);
    }
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

validateEnv();
