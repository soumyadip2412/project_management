import winston from "winston";

/**
 * Structured JSON logs: one object per line, so they can be searched by field
 * (requestId, userId, status) in any log tool rather than grepped as text.
 *
 * Use `logger.error("message", { requestId, err })`. Error objects inside
 * metadata are expanded below; JSON.stringify(new Error()) is "{}", which
 * would otherwise silently drop every stack trace.
 */
const serializeErrors = winston.format((info) => {
    for (const [key, value] of Object.entries(info)) {
        if (value instanceof Error) {
            info[key] = { name: value.name, message: value.message, code: value.code, stack: value.stack };
        }
    }
    return info;
});

const isTest = process.env.NODE_ENV === "test";

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    // Tests assert on HTTP responses; hundreds of expected 4xx lines would
    // bury real failures. Set LOG_LEVEL to see them anyway.
    silent: isTest && !process.env.LOG_LEVEL,
    format: winston.format.combine(
        serializeErrors(),
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: "project-camp-backend" },
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
    ],
});

// Human-readable console output outside production. (In production the JSON
// files, or stdout collected by the platform, are the source of truth.)
if (process.env.NODE_ENV !== "production" && !isTest) {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
                    const details = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                    return `${timestamp} ${level}: ${message}${details}`;
                })
            ),
        })
    );
}

export default logger;
