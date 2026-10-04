import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-errors.js";
import { asynchandler } from "../utils/asynchandler.js";
import logger from "../utils/logger.js";
import { emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail } from "../utils/mail.js";

/*
 * Session model
 * -------------
 * Login issues two JWTs, both delivered ONLY as httpOnly cookies (never in the
 * response body, so page JavaScript, and therefore XSS, cannot read them):
 *
 *   accessToken   15 min, sent on every API request, verified statelessly
 *   refreshToken  7 days, sent only to /api/v1/auth, trades for a new pair
 *
 * The database stores a SHA-256 hash of the current refresh token (one session
 * per user) and a tokenVersion that every token embeds. Bumping tokenVersion
 * revokes everything issued before, including unexpired access tokens.
 */

const isProduction = () => process.env.NODE_ENV === "production";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// SameSite=None is required when the SPA and API are on different sites
// (it must then be Secure). CSRF is handled by the Origin check in app.js.
const baseCookie = () => ({
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
});
const ACCESS_COOKIE = () => ({ ...baseCookie(), path: "/" });
// The refresh token is only needed by the auth routes, so the browser does not
// send it anywhere else.
const REFRESH_COOKIE = () => ({ ...baseCookie(), path: "/api/v1/auth" });

// Cookie lifetime = token lifetime, read back from the signed token itself.
const maxAgeOf = (token) => jwt.decode(token).exp * 1000 - Date.now();

/**
 * Issues a new token pair, stores the refresh hash, sets both cookies.
 * `replacedHash` is the hash being rotated out (refresh only).
 */
const startSession = async (res, user, replacedHash) => {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    await User.updateOne({ _id: user._id }, {
        $set: {
            refreshTokenHash: sha256(refreshToken),
            previousRefreshTokenHash: replacedHash,
            refreshRotatedAt: new Date(),
        },
    });

    res.cookie("accessToken", accessToken, { ...ACCESS_COOKIE(), maxAge: maxAgeOf(accessToken) });
    res.cookie("refreshToken", refreshToken, { ...REFRESH_COOKIE(), maxAge: maxAgeOf(refreshToken) });
};

const clearSessionCookies = (res) => {
    res.clearCookie("accessToken", ACCESS_COOKIE());
    res.clearCookie("refreshToken", REFRESH_COOKIE());
};

const sendVerificationEmail = async (user) => {
    const { unHashedToken, HashedToken, tokenExpiry } = user.generateTempToken();
    user.emailVerificationToken = HashedToken;
    user.emailVerificationExpiry = tokenExpiry;
    await user.save();

    // The link opens the frontend, which calls GET /auth/verify-email/:token and
    // shows the outcome. Linking to the API directly showed users raw JSON.
    const redirectUrl = process.env.EMAIL_VERIFICATION_REDIRECT_URL || "http://localhost:5173/auth/verify-email";
    await sendEmail({
        email: user.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(user.username, `${redirectUrl}/${unHashedToken}`),
    });
};

const registerUser = asynchandler(async (req, res) => {
    const { email, fullName, password, username } = req.body;

    if (await User.exists({ $or: [{ username }, { email }] })) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // Only whitelisted fields: systemRole, isActive, etc. can never be set here.
    const user = await User.create({ email, fullName, password, username });

    try {
        await sendVerificationEmail(user);
    } catch (err) {
        logger.error("Failed to send verification email", { requestId: req.id, err });
    }

    return res.status(201).json(
        new ApiResponse(201, { user }, "User registered successfully. Verification email has been sent.")
    );
});

const login = asynchandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    // Same message whether the email or the password is wrong, and the password
    // is checked BEFORE the account status, so a 403 "deactivated" answer is
    // only ever given to someone who already knows the password.
    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid email or password");
    }
    if (user.isActive === false) {
        throw new ApiError(403, "Your account has been deactivated. Please contact support.");
    }

    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    await startSession(res, user);
    return res.status(200).json(new ApiResponse(200, { user }, "User logged in successfully"));
});

const logoutuser = asynchandler(async (req, res) => {
    // Revoking (not just clearing cookies) matters: a copied access token
    // stops working on the next request instead of living until it expires.
    req.user.revokeSessions();
    await req.user.save();

    clearSessionCookies(res);
    return res.status(200).json(new ApiResponse(200, {}, "User logged out successfully"));
});

const getcurrentuser = asynchandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const verifyemail = asynchandler(async (req, res) => {
    const user = await User.findOne({
        emailVerificationToken: sha256(req.params.emailVerificationToken),
        emailVerificationExpiry: { $gt: Date.now() },
    });
    if (!user) throw new ApiError(400, "Token is invalid or expired");

    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    user.isEmailVerified = true;
    await user.save();

    return res.status(200).json(new ApiResponse(200, { isEmailVerified: true }, "Email has been verified successfully"));
});

const resendemailverification = asynchandler(async (req, res) => {
    if (req.user.isEmailVerified) throw new ApiError(409, "Email is already verified");

    try {
        await sendVerificationEmail(req.user);
    } catch {
        throw new ApiError(503, "The verification email could not be sent. Please try again later.");
    }
    return res.status(200).json(new ApiResponse(200, {}, "Verification mail has been sent to your email"));
});

// How long the token that was just rotated out is still accepted. Covers two
// tabs refreshing at the same moment with the same cookie.
const ROTATION_GRACE_MS = 30_000;

const sameHash = (a, b) =>
    Boolean(a && b) && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Refresh-token rotation with reuse detection.
 * Every refresh replaces the stored hash, so each refresh token works once.
 *  - current token          → rotate: new pair, new cookies
 *  - token rotated out <30s → a concurrent tab already rotated; the browser now
 *                             holds the new cookies, so just answer 200
 *  - anything older         → a copy of a used token is being replayed: revoke
 *                             every session rather than guess who is legitimate
 */
const refreshAccessToken = asynchandler(async (req, res) => {
    const incoming = req.cookies?.refreshToken;
    if (!incoming) throw new ApiError(401, "Refresh token is missing");

    let payload;
    try {
        payload = jwt.verify(incoming, process.env.REFRESH_TOKEN_SECRET);
    } catch {
        clearSessionCookies(res);
        throw new ApiError(401, "Invalid or expired refresh token");
    }

    const user = await User.findById(payload._id).select("+refreshTokenHash +previousRefreshTokenHash +refreshRotatedAt");
    if (!user || user.tokenVersion !== payload.tv) {
        clearSessionCookies(res);
        throw new ApiError(401, "Session is no longer valid");
    }
    if (user.isActive === false) throw new ApiError(403, "Your account has been deactivated");

    const presented = sha256(incoming);

    if (sameHash(presented, user.refreshTokenHash)) {
        await startSession(res, user, user.refreshTokenHash);
        return res.status(200).json(new ApiResponse(200, {}, "Session refreshed"));
    }

    const withinGrace = Date.now() - (user.refreshRotatedAt?.getTime() ?? 0) < ROTATION_GRACE_MS;
    if (withinGrace && sameHash(presented, user.previousRefreshTokenHash)) {
        return res.status(200).json(new ApiResponse(200, {}, "Session already refreshed"));
    }

    logger.warn("Refresh token reuse detected; revoking all sessions", { requestId: req.id, userId: user._id });
    user.revokeSessions();
    await user.save();
    clearSessionCookies(res);
    throw new ApiError(401, "Session is no longer valid");
});

const forgotpasswordrequest = asynchandler(async (req, res) => {
    const genericResponse = new ApiResponse(
        200, {}, "If an account with that email exists, a password reset link has been sent."
    );

    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(200).json(genericResponse);

    const { unHashedToken, HashedToken, tokenExpiry } = user.generateTempToken();
    user.forgetPasswordToken = HashedToken;
    user.forgetPasswordExpiry = tokenExpiry;
    await user.save();

    const redirectUrl = process.env.FORGOT_PASSWORD_REDIRECT_URL || "http://localhost:5173/auth/reset-password";
    // Not awaited: the response time must not depend on whether the account
    // exists (awaiting the SMTP round trip made existing emails measurably slower).
    sendEmail({
        email: user.email,
        subject: "Password reset request",
        mailgenContent: forgotPasswordMailgenContent(user.username, `${redirectUrl}/${unHashedToken}`),
    }).catch((err) => logger.error("Failed to send password reset email", { requestId: req.id, err }));

    return res.status(200).json(genericResponse);
});

const resetforgotpassword = asynchandler(async (req, res) => {
    const user = await User.findOne({
        forgetPasswordToken: sha256(req.params.resetToken),
        forgetPasswordExpiry: { $gt: Date.now() },
    });
    if (!user) throw new ApiError(400, "Token is invalid or expired");

    user.forgetPasswordToken = undefined;
    user.forgetPasswordExpiry = undefined;
    user.password = req.body.newPassword;
    user.revokeSessions(); // whoever had the old password is logged out everywhere
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset has been successful. Please log in with your new password.")
    );
});

const changecurrentpassword = asynchandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.isPasswordCorrect(oldPassword))) throw new ApiError(400, "Invalid current password");

    user.password = newPassword;
    user.revokeSessions(); // log out every other device...
    await user.save();
    await startSession(res, user); // ...but keep this one signed in

    return res.status(200).json(new ApiResponse(200, {}, "Password has been changed successfully."));
});

// Deliberate trade-off: this lets the signup form say "email taken" early, at
// the cost of revealing whether an email is registered. It sits behind the
// strict auth rate limiter to make bulk enumeration slow.
const checkEmailAvailability = asynchandler(async (req, res) => {
    const taken = await User.exists({ email: req.query.email.toLowerCase() });
    return res.status(200).json(new ApiResponse(200, { available: !taken }, "Email availability checked"));
});

const updateProfile = asynchandler(async (req, res) => {
    const { fullName, jobTitle, department, phone, timezone, locale, preferences } = req.body;
    const user = req.user;

    // Explicit whitelist: systemRole, isActive, email etc. are never assignable here.
    const fields = { fullName, jobTitle, department, phone, timezone, locale };
    for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined) user[field] = value;
    }

    if (preferences) {
        const { theme, defaultProjectView, density, notifications = {} } = preferences;
        if (theme !== undefined) user.preferences.theme = theme;
        if (defaultProjectView !== undefined) user.preferences.defaultProjectView = defaultProjectView;
        if (density !== undefined) user.preferences.density = density;
        for (const channel of ["email", "inApp", "push"]) {
            if (notifications[channel] !== undefined) user.preferences.notifications[channel] = notifications[channel];
        }
    }

    await user.save();
    return res.status(200).json(new ApiResponse(200, user, "Profile updated successfully"));
});

const handleOAuthCallback = asynchandler(async (req, res) => {
    if (!req.user) throw new ApiError(401, "Authentication failed");

    await startSession(res, req.user);
    const clientUrl = process.env.CLIENT_SSO_REDIRECT_URL || process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173";
    return res.redirect(`${clientUrl}/dashboard`);
});

export {
    login,
    logoutuser,
    registerUser,
    getcurrentuser,
    verifyemail,
    resendemailverification,
    refreshAccessToken,
    forgotpasswordrequest,
    resetforgotpassword,
    changecurrentpassword,
    checkEmailAvailability,
    updateProfile,
    handleOAuthCallback,
};
