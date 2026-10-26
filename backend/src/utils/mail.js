/**
 * FILE: backend/src/utils/mail.js
 *
 * PURPOSE
 *   Sends transactional email (email verification and password reset).
 *     - Mailgen builds a good-looking HTML email plus a plain-text version from
 *       a small JSON description (name, intro, button, outro).
 *     - Nodemailer delivers it over SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER,
 *       SMTP_PASS and MAIL_FROM (the older MAIL_TRAP_* names still work, e.g.
 *       the Mailtrap sandbox in development).
 *
 * RENDER'S FREE PLAN blocks outbound ports 25, 465 and 587, so use a provider
 * that also listens on 2525 there (Brevo: smtp-relay.brevo.com:2525).
 *
 * WHO CALLS IT
 *   controllers/auth.controllers.js: register, resend verification, forgot password.
 *   It builds the link (FRONTEND_PAGE + "/" + raw token) and passes
 *   emailVerificationMailgenContent(...) or forgotPasswordMailgenContent(...)
 *   into sendEmail({ email, subject, mailgenContent }).
 *
 * TEST SUPPORT
 *   Under NODE_ENV=test nothing goes over the network (jsonTransport), and each
 *   message is stored in `testOutbox`. API tests, and the E2E server's
 *   GET /__e2e/last-email endpoint, read the real link from there and "click" it.
 *
 * INTERVIEW NOTES
 *   Q: Why send a link with a random token instead of a code in the URL?
 *   A: The token is random, single-use and time-limited, and only its SHA-256
 *      hash is stored in the database. A database leak therefore does not
 *      leak usable reset links.
 */
import Mailgen from "mailgen";
import nodemailer from "nodemailer"
import logger from "./logger.js";

/**
 * Nodemailer SMTP options from the environment, or null when no host is set.
 * Port 465 is implicit TLS; any other port upgrades with STARTTLS when offered.
 */
const smtpOptions = (env = process.env) => {
    const host = env.SMTP_HOST || env.MAIL_TRAP_HOST
    if (!host) return null
    const port = Number(env.SMTP_PORT || env.MAIL_TRAP_PORT) || 587
    const user = env.SMTP_USER || env.MAIL_TRAP_USER
    const pass = env.SMTP_PASS || env.MAIL_TRAP_PASS
    return {
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
        // Fail in seconds, not minutes, when a port is blocked.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
    }
}

/** The From header. With a real provider it must be a sender verified there. */
const mailFrom = (env = process.env) => env.MAIL_FROM || "Setu <no-reply@setu.local>"

// Tests must never send real mail: jsonTransport builds the message and
// discards it, without any network access.
const createTransport = () => {
    if (process.env.NODE_ENV === "test") return nodemailer.createTransport({ jsonTransport: true })
    const options = smtpOptions()
    if (!options) throw new Error("Email is not configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM")
    return nodemailer.createTransport(options)
}

// Under NODE_ENV=test every message is also kept here (newest last), so API
// tests and the E2E server can follow the links a real user would receive.
const testOutbox = []

/**
 * Renders and sends one email.
 * @param {object} options
 * @param {string} options.email           recipient address
 * @param {string} options.subject
 * @param {object} options.mailgenContent  output of one of the *MailgenContent builders below
 * @throws if SMTP delivery fails (after logging it)
 */
const sendEmail = async (options) =>{
    const mailgenerator=new Mailgen({
        theme: "default",
        product:{
            name: "Setu",
            // The web app: the first CORS origin is the deployed frontend.
            link: (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].trim()
        }
    })
    const emailText = mailgenerator.generatePlaintext(options.mailgenContent)// mailgen jo hai woh ek module hi hai jo ki nodemailer jaise import karna padega that's in the package.json file
    // (Translation: Mailgen is a separate npm module, imported just like nodemailer; see package.json.)

    const emailHtml = mailgenerator.generate(options.mailgenContent)

    const mail = {
            from: mailFrom(),
            to:options.email,
            subject:options.subject,
            text: emailText,
            html: emailHtml
        }
    // Errors propagate: the caller decides whether a failed email should fail
    // the request (resend verification) or only be logged (registration).
    try {
        await createTransport().sendMail(mail)
        if (process.env.NODE_ENV === "test") {
            testOutbox.push({ to: mail.to, subject: mail.subject, text: mail.text })
            // Cap the outbox so a long test run cannot grow memory without bound.
            if (testOutbox.length > 100) testOutbox.shift()
        }
    } catch (error) {
        logger.error("Email delivery failed (check the SMTP_* and MAIL_FROM settings)", { err: error })
        throw error
    }
}

/**
 * Mailgen body for the "verify your email" message.
 * @param {string} username
 * @param {string} verificationURL  frontend page URL ending in the raw token
 */
const emailVerificationMailgenContent= (username,verificationURL) => {
    return {
        body:{
        name: username,
        intro: "Welcome to Setu. We are excited to have you on board.",
        action:{
            instructions: "To verify your email please click on the following button.",
            button:{
            color: "#2da050",
            text: "Verify your email",
            link: verificationURL
            },
        },
        outro: "Need help, or have questions? Just reply to this email, we'd love to help you. "
    }
}
}



/**
 * Mailgen body for the "reset your password" message.
 * @param {string} username
 * @param {string} passwordURL  frontend reset page URL ending in the raw token
 */
const forgotPasswordMailgenContent= (username,passwordURL) => {
    return {
        body:{
        name: username,
        intro: "We got a request to reset the password of your account.",
        action:{
            instructions: "To reset your password, please click on the following button.",
            button:{
            color: "#ac2420",
            text: "Reset your password",
            link: passwordURL
            },
        },
        outro: "Need help, or have questions? Just reply to this email, we'd love to help you. "
    }
}
}

export { emailVerificationMailgenContent,forgotPasswordMailgenContent,mailFrom,sendEmail,smtpOptions,testOutbox }