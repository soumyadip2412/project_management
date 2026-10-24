/**
 * FILE: backend/src/config/passport.js
 *
 * PURPOSE
 *   Configures Passport.js for "Sign in with Google / GitHub" (OAuth 2.0).
 *   Passport is only used to run the OAuth dance and turn a provider
 *   profile into one of OUR User documents. After that, the app issues its
 *   own JWT cookies exactly like a password login (see auth.controllers.js).
 *   No Passport sessions are used.
 *
 * OAUTH FLOW (high level)
 *   1. Browser → GET /api/v1/auth/google → redirect to Google's consent page.
 *   2. Google → GET /api/v1/auth/google/callback?code=... → Passport swaps the
 *      code for the user's profile and calls `verifyCallback` below.
 *   3. findOrCreateOAuthUser() returns a User; the route handler sets cookies
 *      and redirects to the frontend.
 *
 * WHERE IT FITS
 *   app.js calls `passport.initialize()`; routes/auth.routes.js uses
 *   `passport.authenticate("google" | "github", ...)`.
 *   A provider is only registered if its CLIENT_ID and CLIENT_SECRET env vars exist.
 *
 * INTERVIEW NOTES
 *   Q: What is a "pre-account takeover" and how do you prevent it?
 *   A: An attacker registers victim@x.com with a password before the real
 *      owner ever uses the app. Later the owner signs in with Google and the
 *      accounts get linked, so the attacker's password still works. The fix:
 *      when linking to an account whose email was never verified, drop that
 *      password and revoke its sessions (see below).
 *   Main task of Passport is to turn a provider profile into one of OUR User documents. After that, the app issues its own JWT cookies exactly like a password login (see auth.controllers.js). No Passport sessions are used.
 */
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import crypto from "crypto";//crypto is a built-in Node.js module that provides cryptographic functionality, including a set of wrappers for OpenSSL's hash, HMAC, cipher, decipher, sign, and verify functions. In this code, it is used to generate random bytes for creating unique usernames when there is a conflict with an existing username in the database.
import { User } from "../models/user.models.js";

/**
 * Derives a username from the provider's display name / handle.
 * Keeps only a-z0-9 and at most 15 characters. If it is taken, it appends 6
 * random hex characters (3 random bytes).
 * @param {string|undefined} baseName
 * @returns {Promise<string>}
 */
const generateUniqueUsername = async (baseName) => {
    const username = (baseName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
    if (!(await User.exists({ username }))) return username;
    return `${username}_${crypto.randomBytes(3).toString("hex")}`;
};//generateUniqueUsername is an asynchronous function that takes a baseName (string or undefined) as input and returns a Promise that resolves to a unique username. It processes the baseName to create a valid username by converting it to lowercase, removing any characters that are not a-z or 0-9, and limiting it to 15 characters. If the resulting username already exists in the User collection, it appends an underscore followed by 6 random hexadecimal characters (generated using crypto.randomBytes) to ensure uniqueness. If the baseName is undefined or results in an empty string after processing, it defaults to "user".

/**
 * Shared sign-in logic for every OAuth provider.
 *
 * 1. Known provider id → that user.
 * 2. Known email       → link the provider to the existing account.
 * 3. Otherwise         → create an account.
 *
 * Linking guard (pre-account takeover): if the existing account never verified
 * its email, someone else may have registered it first with a password they
 * know, waiting for the real owner to sign in with Google. The provider has
 * just proved who owns the address, so the unverified password is discarded
 * and any sessions issued with it are revoked.
 *
 * @param {object} args
 * @param {"GOOGLE"|"GITHUB"} args.provider   stored as user.loginType
 * @param {"googleId"|"githubId"} args.idField which User field holds the provider id
 * @param {object} args.profile               the profile Passport received from the provider
 * @param {string} [args.preferredUsername]
 * @returns {Promise<User>}
 */
const findOrCreateOAuthUser = async ({ provider, idField, profile, preferredUsername }) => {
    // `[idField]` is a computed key: { googleId: profile.id } or { githubId: profile.id }.
    const existingByProvider = await User.findOne({ [idField]: profile.id });
    if (existingByProvider) return existingByProvider;

    // GitHub users can hide their email, so it may be missing.
    const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;

    if (email) {
        const existing = await User.findOne({ email });
        if (existing) {
            existing[idField] = profile.id;
            if (!existing.isEmailVerified) {
                existing.password = undefined;
                existing.loginType = provider;
                existing.revokeSessions(); // bumps tokenVersion → every old JWT stops working
            }
            existing.isEmailVerified = true; // the provider has proved ownership
            await existing.save();
            return existing;
        }
    }

    const username = await generateUniqueUsername(preferredUsername || email?.split("@")[0]);
    return User.create({
        [idField]: profile.id,
        // No email from the provider: use a unique placeholder so the unique email index still holds.
        email: email || `${profile.id}@${provider.toLowerCase()}.oauth`,
        fullName: profile.displayName || username,
        username,
        isEmailVerified: true,
        loginType: provider,
        avatar: { URL: profile.photos?.[0]?.value || "https://placehold.co/300x200", LocalPath: "" },
    });
};

/**
 * Builds the "verify" function Passport calls once the provider returns a profile.
 * Passport's callback convention is `done(error, user)`.
 * `options(profile)` supplies the provider-specific bits (name, id field).
 * The provider's own access/refresh tokens are not needed and are ignored.
 */
const verifyCallback = (options) => async (accessToken, refreshToken, profile, done) => {
    try {
        done(null, await findOrCreateOAuthUser({ ...options(profile), profile }));
    } catch (error) {
        done(error, null);
    }
};

// Each provider is registered only when its credentials are configured.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Must exactly match the redirect URI registered in the Google console.
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:8000/api/v1/auth/google/callback",
        },
        verifyCallback((profile) => ({ provider: "GOOGLE", idField: "googleId", preferredUsername: profile.displayName }))
    ));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:8000/api/v1/auth/github/callback",
        },
        verifyCallback((profile) => ({ provider: "GITHUB", idField: "githubId", preferredUsername: profile.username }))
    ));
}

export default passport;
