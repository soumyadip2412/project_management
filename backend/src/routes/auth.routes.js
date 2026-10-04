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

// Mounted behind the strict auth rate limiter (see app.js).
const router = Router();

const oauthFailure = () => ({
    session: false,
    failureRedirect: `${process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:5173"}/login`,
});

// ─── Public ──────────────────────────────────
router.get("/check-email", checkEmailValidator(), validate, checkEmailAvailability);
router.post("/register", userRegisterValidator(), validate, registerUser);
router.post("/login", userLoginValidator(), validate, login);
router.get("/verify-email/:emailVerificationToken", verifyemail);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", userForgotPasswordValidator(), validate, forgotpasswordrequest);
router.post("/reset-password/:resetToken", userResetForgotPasswordValidator(), validate, resetforgotpassword);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", oauthFailure()), handleOAuthCallback);
router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get("/github/callback", passport.authenticate("github", oauthFailure()), handleOAuthCallback);

// ─── Authenticated ───────────────────────────
router.post("/logout", verifyJWT, logoutuser);
router.get("/current-user", verifyJWT, getcurrentuser);
router.post("/change-password", verifyJWT, userChangeCurrentPasswordValidator(), validate, changecurrentpassword);
router.put("/update-profile", verifyJWT, updateProfileValidator(), validate, updateProfile);
router.post("/resend-email-verification", verifyJWT, resendemailverification);

export default router;
