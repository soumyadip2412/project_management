/**
 * FILE: backend/src/utils/api-errors.js
 *
 * PURPOSE
 *   ApiError is the ONE error type controllers throw for expected failures
 *   ("not found", "forbidden", "invalid input"). It carries an HTTP status code.
 *
 * HOW IT IS USED
 *   throw new ApiError(404, "Task not found");
 *   throw new ApiError(422, "Validation failed", [{ field: "title", message: "..." }]);
 *   The throw rejects the controller's promise; asynchandler forwards it to
 *   the central error handler in app.js, which sends:
 *     { statusCode, success: false, message, errors, requestId }
 *
 * WHY EXTEND Error
 *   Subclassing the built-in Error gives a stack trace and lets the error
 *   handler tell "our" errors apart from library errors with
 *   `err instanceof ApiError`.
 *
 * INTERVIEW NOTES
 *   Q: Why throw instead of `return res.status(404).json(...)`?
 *   A: One place formats every error response, so they are consistent.
 *      Throwing also stops execution immediately, even from deep inside a
 *      helper function.
 */
//yeh har jagah same hi kaam karta toh ratt k samjh lo baad mein kam aa jayega aur kya
// (Translation: "this works the same everywhere, so learn it once and it will keep paying off.")
class ApiError extends Error{
    /**
     * @param {number} statusCode HTTP status (4xx for client errors, 5xx for server errors)
     * @param {string} [message]  safe, human-readable message sent to the client
     * @param {Array}  [errors]   optional details, e.g. per-field validation errors
     * @param {string} [stack]    reuse an existing stack trace (rarely needed)
     */
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else {
            // V8 API: records where the error was created and leaves the
            // constructor itself out of the trace.
            Error.captureStackTrace(this, this.constructor)
        }
    }
}
export { ApiError };