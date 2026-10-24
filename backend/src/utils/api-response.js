/**
 * FILE: backend/src/utils/api-response.js
 *
 * PURPOSE
 *   The standard envelope for every SUCCESSFUL response, so the frontend
 *   always receives the same shape:
 *     { statusCode: 200, data: <payload>, message: "Success", success: true }
 *
 * USAGE (in every controller)
 *   return res.status(201).json(new ApiResponse(201, task, "Task created"));
 *
 * Its counterpart for failures is ApiError (utils/api-errors.js), turned into
 * JSON by the error handler in app.js. The frontend's lib/api.js reads `.data`
 * on success and `.message` / `.errors` on failure.
 */
class ApiResponse{
    /**
     * @param {number} statusCode HTTP status (the same number passed to res.status)
     * @param {*}      data       the payload: a document, a list, or a { items, pagination } object
     * @param {string} [message]  short human-readable summary
     */
    constructor(statusCode,data,message="Success"){
        this.statusCode = statusCode
        this.data = data
        this.message = message
        // Anything below 400 counts as success (2xx and 3xx).
        this.success = statusCode <400
    }
}
export { ApiResponse }