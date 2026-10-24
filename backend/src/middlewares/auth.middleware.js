/**
 * FILE: backend/src/middlewares/auth.middleware.js
 *
 * PURPOSE
 *   `verifyJWT`: the authentication gate. It runs first on every protected
 *   route (`router.use(verifyJWT)` in most route files) and sets `req.user`
 *   for everything after it. 401 = "not logged in / session invalid";
 *   403 = "logged in, but the account is deactivated".
 *
 * WHERE THE TOKEN COMES FROM
 *   auth.controllers.js (login / refresh) signs a JWT containing
 *   { _id, tv: tokenVersion, jti } and sets it as the httpOnly `accessToken`
 *   cookie (15 min). The browser sends it back automatically on every request
 *   (the frontend uses credentials: "include"). When it expires, the frontend
 *   calls /auth/refresh-token, which uses the longer-lived refresh cookie.
 *
 * INTERVIEW NOTES
 *   Q: JWTs are "stateless". Why query the database on every request?
 *   A: A pure stateless JWT cannot be revoked before it expires. One indexed
 *      findById buys instant logout, password-change revocation, deactivation
 *      and fresh roles. That is a deliberate trade of a little speed for control.
 *   Q: What is `tv` (token version)?
 *   A: A counter on the user. Every token carries the value at issue time.
 *      user.revokeSessions() increments it, so every outstanding token now
 *      mismatches and is rejected.
 *   Q: Cookie vs. Authorization header?
 *   A: httpOnly cookies cannot be read by JavaScript, so an XSS bug cannot
 *      steal the token. The cost is having to defend against CSRF (see
 *      security.middleware.js).
 */
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/api-errors.js";

/**
 * Authentication: who is calling?
 *
 * 1. Read the access token from the httpOnly `accessToken` cookie. It is the
 *    only transport: the token is never exposed to JavaScript, so an XSS bug
 *    cannot steal it.
 * 2. Verify signature and expiry (stateless, no database).
 * 3. Load the user. This one query is what makes the rest possible:
 *    - a deleted or deactivated account is rejected immediately;
 *    - `tv` (token version) must match, so logout / password change /
 *      deactivation revoke even access tokens that have not expired yet;
 *    - role and status come from the database, never from stale token claims.
 */
export const verifyJWT = asynchandler(async (req, res, next) => {
    const token = req.cookies?.accessToken;
    if (!token) throw new ApiError(401, "Authentication required");

    let payload;
    // jwt.verify throws on a bad signature, a malformed token or an expired
    // `exp`. All of these mean "log in again", so they map to one 401.
    try {
        payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
        throw new ApiError(401, "Invalid or expired access token");
    }

    const user = await User.findById(payload._id);
    if (!user || user.tokenVersion !== payload.tv) {
        throw new ApiError(401, "Session is no longer valid");
    }
    if (user.isActive === false) {
        throw new ApiError(403, "Your account has been deactivated. Please contact an administrator.");
    }

    // Every later middleware and controller reads the caller from here.
    req.user = user;
    next();
});
