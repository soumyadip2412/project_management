import { test } from "node:test";
import assert from "node:assert/strict";
import { mailFrom, smtpOptions } from "../src/utils/mail.js";

test("SMTP_* settings are used, with STARTTLS on ports other than 465", () => {
    const options = smtpOptions({ SMTP_HOST: "smtp-relay.brevo.com", SMTP_PORT: "2525", SMTP_USER: "u", SMTP_PASS: "p" });
    assert.equal(options.host, "smtp-relay.brevo.com");
    assert.equal(options.port, 2525);
    assert.equal(options.secure, false);
    assert.deepEqual(options.auth, { user: "u", pass: "p" });
});

test("port 465 uses implicit TLS", () => {
    assert.equal(smtpOptions({ SMTP_HOST: "h", SMTP_PORT: "465" }).secure, true);
});

test("the older MAIL_TRAP_* names still work", () => {
    const options = smtpOptions({ MAIL_TRAP_HOST: "sandbox.smtp.mailtrap.io", MAIL_TRAP_PORT: "2525", MAIL_TRAP_USER: "u", MAIL_TRAP_PASS: "p" });
    assert.equal(options.host, "sandbox.smtp.mailtrap.io");
    assert.equal(options.port, 2525);
    assert.deepEqual(options.auth, { user: "u", pass: "p" });
});

test("no host means email is not configured", () => {
    assert.equal(smtpOptions({}), null);
});

test("the sender comes from MAIL_FROM", () => {
    assert.equal(mailFrom({ MAIL_FROM: "Setu <team@example.org>" }), "Setu <team@example.org>");
    assert.match(mailFrom({}), /Setu/);
});
