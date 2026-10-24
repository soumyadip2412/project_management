/**
 * FILE: backend/src/utils/asynchandler.js
 *
 * PURPOSE
 *   Wraps an async route handler so that a thrown error or a rejected promise
 *   is passed to Express's `next(err)`, and so reaches the central error
 *   handler in app.js, instead of becoming an unhandled rejection that leaves
 *   the request hanging.
 *
 * USAGE
 *   export const getTask = asynchandler(async (req, res) => {
 *       const task = await Task.findById(...);
 *       if (!task) throw new ApiError(404, "Task not found");  // → next(err)
 *       res.json(new ApiResponse(200, task));
 *   });
 *
 * INTERVIEW NOTES
 *   Q: Express 5 already forwards rejected promises. Why keep this?
 *   A: It is harmless and explicit, it works the same on Express 4, and the
 *      codebase was written with it. Every controller is wrapped the same way,
 *      so the behaviour is uniform.
 *   Q: Why `Promise.resolve(...)`?
 *   A: It also handles a handler that is NOT async (returns a plain value):
 *      the result is always a promise, so `.catch` is always available.
 *      Note: a synchronous throw inside a non-async handler happens before
 *      Promise.resolve runs and is not caught here; Express itself catches
 *      synchronous throws.
 */
const asynchandler = (requesthandler) =>{
    // Returns a normal (req, res, next) middleware that Express can call.
    return (req,res,next)=>{
        Promise
        .resolve(requesthandler(req,res,next))
        .catch((err=> {
            return next(err)
        }))
    }
}

export { asynchandler }