/**
 * FILE: backend/src/utils/mail.js
 *
 * PURPOSE
 *   Sends transactional email (email verification and password reset).
 *     - Mailgen builds a good-looking HTML email plus a plain-text version from
 *       a small JSON description (name, intro, button, outro).
 *     - Nodemailer delivers it over SMTP (Mailtrap in development, configured
 *       with the MAIL_TRAP_* env vars).
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

// Tests must never send real mail: jsonTransport builds the message and
// discards it, without any network access.
const createTransport = () =>
    process.env.NODE_ENV === "test"
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({
            host: process.env.MAIL_TRAP_HOST,
            port: process.env.MAIL_TRAP_PORT,
            auth: { user: process.env.MAIL_TRAP_USER, pass: process.env.MAIL_TRAP_PASS },
        })

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
            name: "Task Manager",
            link: "https://taskmanagerlink.com"
        }
    })
    const emailText = mailgenerator.generatePlaintext(options.mailgenContent)// mailgen jo hai woh ek module hi hai jo ki nodemailer jaise import karna padega that's in the package.json file
    // (Translation: Mailgen is a separate npm module, imported just like nodemailer; see package.json.)

    const emailHtml = mailgenerator.generate(options.mailgenContent)

    const transporter = createTransport()
    const mail = {
            from: "Mailtestingbbn@example.com",
            to:options.email,
            subject:options.subject,
            text: emailText,
            html: emailHtml
        }
    // Errors propagate: the caller decides whether a failed email should fail
    // the request (resend verification) or only be logged (registration).
    try {
        await transporter.sendMail(mail)
        if (process.env.NODE_ENV === "test") {
            testOutbox.push({ to: mail.to, subject: mail.subject, text: mail.text })
            // Cap the outbox so a long test run cannot grow memory without bound.
            if (testOutbox.length > 100) testOutbox.shift()
        }
    } catch (error) {
        logger.error("Email delivery failed (check MAIL_TRAP_* settings)", { err: error })
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
        intro: "Welcome to our application. We are excited to have you on Board.",
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

export { emailVerificationMailgenContent,forgotPasswordMailgenContent,sendEmail,testOutbox }