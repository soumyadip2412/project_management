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

const sendEmail = async (options) =>{
    const mailgenerator=new Mailgen({
        theme: "default",
        product:{
            name: "Task Manager",
            link: "https://taskmanagerlink.com"
        }
    })
    const emailText = mailgenerator.generatePlaintext(options.mailgenContent)// mailgen jo hai woh ek module hi hai jo ki nodemailer jaise import karna padega that's in the package.json file 
    
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
            if (testOutbox.length > 100) testOutbox.shift()
        }
    } catch (error) {
        logger.error("Email delivery failed (check MAIL_TRAP_* settings)", { err: error })
        throw error
    }
}

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
