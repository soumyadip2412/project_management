/**
 * FILE: backend/src/routes/auth.routes.js   (mounted at /api/v1/auth)
 *
 * ENDPOINTS
 *   Public
 *     GET  /check-email?email=          is this email free? (register form)
 *     POST /register                    create account, send verification email
 *     POST /login                       set accessToken + refreshToken cookies
 *     GET  /verify-email/:token         mark email verified (link from the email)
 *     POST /refresh-token               rotate the refresh token, issue a new access token
 *     POST /forgot-password             email a reset link (always 200, see the controller)
 *     POST /reset-password/:resetToken  set a new password with the emailed token
 *     GET  /google | /github            start OAuth (redirect to the provider)
 *     GET  /google/callback | /github/callback   provider returns here
 *   Authenticated (verifyJWT)
 *     POST /logout                      revoke sessions, clear cookies
 *     GET  /current-user                who am I? (the frontend calls this on startup)
 *     POST /change-password             requires oldPassword
 *     PUT  /update-profile              name, job title, preferences, ...
 *     POST /resend-email-verification
 *
 * Why is /refresh-token NOT behind verifyJWT? It exists precisely for when the
 * access token has expired. It authenticates with the refresh cookie instead.
 */
import { Router } from "express";
import {
    registerUser,
    login,
    logoutuser,
    verifyemail,
    refreshAccessToken,
    forgotpasswordrequest,
    resetforgotpassword,
    getcurrentuser,
    changecurrentpassword,
    resendemailverification,
    resendVerificationByEmail,
    checkEmailAvailability,
    updateProfile,
    handleOAuthCallback,
} from "../controllers/auth.controllers.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    checkEmailValidator,
    updateProfileValidator,
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userLoginValidator,
    userRegisterValidator,
    userResetForgotPasswordValidator,
} from "../validators/validator.index.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import passport from "../config/passport.js";
import { authLimiter } from "../middlewares/rateLimiter.middleware.js";

// authLimiter (strict, 20 / 15 min / IP) is applied ONLY to the credential and
// enumeration endpoints below. Session housekeeping (current-user, refresh-token,
// logout, profile) is deliberately NOT counted: every page load calls current-user.
const router = Router();

// Passport options for the OAuth callbacks: no server session (we issue our
// own JWT cookies), and on failure send the user back to the frontend login
// page (the first origin in CORS_ORIGIN).
const oauthFailure = () => ({
    session: false,
    failureRedirect: `${process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173"}/login`,
});

// ─── Public ──────────────────────────────────
router.get("/check-email", authLimiter, checkEmailValidator(), validate, checkEmailAvailability);
router.post("/register", authLimiter, userRegisterValidator(), validate, registerUser);
router.post("/login", authLimiter, userLoginValidator(), validate, login);
router.get("/verify-email/:emailVerificationToken", verifyemail);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", authLimiter, userForgotPasswordValidator(), validate, forgotpasswordrequest);
router.post("/resend-verification", authLimiter, userForgotPasswordValidator(), validate, resendVerificationByEmail);
router.post("/reset-password/:resetToken", authLimiter, userResetForgotPasswordValidator(), validate, resetforgotpassword);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", oauthFailure()), handleOAuthCallback);
router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get("/github/callback", passport.authenticate("github", oauthFailure()), handleOAuthCallback);

// ─── Authenticated ───────────────────────────
router.post("/logout", verifyJWT, logoutuser);
router.get("/current-user", verifyJWT, getcurrentuser);
router.post("/change-password", verifyJWT, userChangeCurrentPasswordValidator(), validate, changecurrentpassword);
router.put("/update-profile", verifyJWT, updateProfileValidator(), validate, updateProfile);
router.post("/resend-email-verification", authLimiter, verifyJWT, resendemailverification);

export default router;
