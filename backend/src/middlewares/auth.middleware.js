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

    req.user = user;
    next();
});
