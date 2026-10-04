import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import crypto from "crypto";
import { User } from "../models/user.models.js";

const generateUniqueUsername = async (baseName) => {
    const username = (baseName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
    if (!(await User.exists({ username }))) return username;
    return `${username}_${crypto.randomBytes(3).toString("hex")}`;
};

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
 */
const findOrCreateOAuthUser = async ({ provider, idField, profile, preferredUsername }) => {
    const existingByProvider = await User.findOne({ [idField]: profile.id });
    if (existingByProvider) return existingByProvider;

    const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;

    if (email) {
        const existing = await User.findOne({ email });
        if (existing) {
            existing[idField] = profile.id;
            if (!existing.isEmailVerified) {
                existing.password = undefined;
                existing.loginType = provider;
                existing.revokeSessions();
            }
            existing.isEmailVerified = true;
            await existing.save();
            return existing;
        }
    }

    const username = await generateUniqueUsername(preferredUsername || email?.split("@")[0]);
    return User.create({
        [idField]: profile.id,
        email: email || `${profile.id}@${provider.toLowerCase()}.oauth`,
        fullName: profile.displayName || username,
        username,
        isEmailVerified: true,
        loginType: provider,
        avatar: { URL: profile.photos?.[0]?.value || "https://placehold.co/300x200", LocalPath: "" },
    });
};

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
