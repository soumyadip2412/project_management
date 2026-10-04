import { body, query } from "express-validator";

/**
 * Auth request validators.
 *
 * Every field is type-checked before anything else. `isString()` matters for
 * security, not just tidiness: without it a JSON body such as
 * {"email": {"$ne": null}} would reach `User.findOne({ email })` as a MongoDB
 * query operator.
 */

// One password policy, used by register, reset and change.
const passwordRule = (field) =>
    body(field)
        .isString().withMessage(`${field} must be a string`)
        .isLength({ min: 8, max: 128 }).withMessage("Password must be 8-128 characters long")
        .matches(/[A-Za-z]/).withMessage("Password must contain a letter")
        .matches(/\d/).withMessage("Password must contain a number");

const emailRule = (field = "email") =>
    body(field)
        .isString().withMessage("Email is required")
        .trim()
        .isEmail().withMessage("Email is invalid")
        .toLowerCase();

const userRegisterValidator = () => [
    emailRule(),
    body("username")
        .isString().withMessage("Username is required")
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage("Username must be 3-30 characters long")
        .matches(/^[a-z0-9_]+$/).withMessage("Username may contain only lowercase letters, digits and underscores"),
    body("fullName")
        .isString().withMessage("Full name is required")
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage("Full name must be 1-100 characters long"),
    passwordRule("password"),
];

const userLoginValidator = () => [
    emailRule(),
    body("password").isString().notEmpty().withMessage("Password is required"),
];

const userChangeCurrentPasswordValidator = () => [
    body("oldPassword").isString().notEmpty().withMessage("Old password is required"),
    passwordRule("newPassword"),
];

const userForgotPasswordValidator = () => [emailRule()];

const userResetForgotPasswordValidator = () => [passwordRule("newPassword")];

const checkEmailValidator = () => [
    query("email").isString().isEmail().withMessage("A valid email is required"),
];

const optionalText = (field, max) =>
    body(field).optional().isString().withMessage(`${field} must be a string`).trim()
        .isLength({ max }).withMessage(`${field} must be at most ${max} characters`);

const updateProfileValidator = () => [
    body("fullName").optional().isString().trim()
        .isLength({ min: 1, max: 100 }).withMessage("Full name must be 1-100 characters long"),
    optionalText("jobTitle", 100),
    optionalText("department", 100),
    optionalText("phone", 30),
    optionalText("timezone", 64),
    optionalText("locale", 10),
    body("preferences").optional().isObject().withMessage("preferences must be an object"),
    body("preferences.theme").optional().isIn(["light", "dark", "system"]),
    body("preferences.defaultProjectView").optional().isIn(["board", "list", "timeline"]),
    body("preferences.density").optional().isIn(["comfortable", "compact"]),
    body("preferences.notifications.email").optional().isBoolean({ strict: true }),
    body("preferences.notifications.inApp").optional().isBoolean({ strict: true }),
    body("preferences.notifications.push").optional().isBoolean({ strict: true }),
];

export {
    userRegisterValidator,
    userLoginValidator,
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userResetForgotPasswordValidator,
    checkEmailValidator,
    updateProfileValidator,
};
