/**
 * FILE: backend/src/middlewares/audit.middleware.js
 *
 * WHERE IT FITS (last step before the controller)
 *   verifyJWT → authorize* → validator → validate → audit(entity, action) → controller
 *
 * INTERVIEW NOTES
 *   Q: Why audit in middleware instead of inside each controller?
 *   A: It is declarative (one line per route), it cannot be forgotten in one
 *      code path, and it only records writes that actually succeeded.
 *   Q: What is "monkey-patching res.json"?
 *   A: We replace res.json on THIS response object with our own function. Ours
 *      writes the audit record, then calls the original. The controller does
 *      not know it is being audited.
 *   Q: Why fire-and-forget (not awaited)?
 *   A: An audit-log hiccup must not fail or slow the user's request. Failures
 *      are logged instead. The trade-off: in rare cases an entry can be lost.
 *
 * Audit middleware — records successful mutations in AuditLog.
 * Usage: router.post("/", authorizeProject("task", "create"), audit("task", "created"), handler)
 *
 * How it works: it wraps res.json. When the controller responds with a status
 * below 400, one AuditLog document is written in the background (the response
 * is never delayed or failed by auditing).
 *
 * Two rules keep the trail trustworthy:
 *  1. The entity type and action are checked against the model's enums when
 *     the route is DEFINED. A typo crashes the server at startup instead of
 *     every write failing silently at runtime (which is what used to happen
 *     for member, invitation and sprint events).
 *  2. Project/workspace/entity ids come from the URL or from documents that
 *     authorization already loaded, never from the request body, so a client
 *     cannot attribute an entry to a project it does not belong to.
 */
import { AuditLog } from "../models/auditLog.models.js";
import { AvailableAuditActions, AvailableEntityTypes } from "../utils/constants.js";
import logger from "../utils/logger.js";

// Which URL parameter identifies each kind of entity.
const ENTITY_ID_PARAM = {
    workspace: "workspaceId",
    project: "projectId",
    task: "taskId",
    sprint: "sprintId",
    comment: "commentId",
    note: "noteId",
    member: "userId",
    user: "userId",
};

/**
 * Factory: returns a middleware that audits this route.
 * The two checks below run ONCE, when the route file is loaded (at startup),
 * not on every request. That is what "throws at route-definition time" means.
 * @param {string} entityType one of EntityTypeEnum (e.g. "task")
 * @param {string} action     one of AuditActionEnum (e.g. "updated")
 */
export const audit = (entityType, action) => {
    if (!AvailableEntityTypes.includes(entityType)) {
        throw new Error(`audit(): unknown entity type "${entityType}"`);
    }
    if (!AvailableAuditActions.includes(action)) {
        throw new Error(`audit(): unknown action "${action}"`);
    }

    return (req, res, next) => {
        // Keep the real res.json (bound so `this` still points at res) and
        // replace it with a wrapper that audits, then delegates.
        const originalJson = res.json.bind(res);

        res.json = (body) => {
            if (res.statusCode < 400) {
                // Created resources have no id in the URL yet: take it from the
                // response. A member action with no :userId is the caller acting
                // on themselves (accepting an invitation).
                const entityId =
                    req.params[ENTITY_ID_PARAM[entityType]] ??
                    (entityType === "member" ? req.user?._id : body?.data?._id);

                const project = req.project?._id ?? req.params.projectId ??
                    (entityType === "project" ? entityId : undefined);

                // The response body is server-generated, so reading ids from it
                // is safe (unlike the request body).
                const workspace = req.workspace?._id ?? req.project?.workspace ??
                    (entityType === "workspace" ? entityId : body?.data?.workspace);

                // Deliberately NOT awaited (fire-and-forget); .catch prevents
                // an unhandled rejection if the write fails.
                AuditLog.create({
                    workspace,
                    project,
                    entityType,
                    entityId,
                    action,
                    actor: req.user?._id,
                    changes: req._auditChanges || [],
                    ipAddress: req.ip,
                    userAgent: req.get("User-Agent"),
                }).catch((err) => logger.error("Audit log write failed", { requestId: req.id, err }));
            }

            return originalJson(body);
        };

        next();
    };
};

/**
 * Records a field-level diff for the audit entry. Call in a controller before
 * saving: trackChanges(req, task, { priority: "high" }).
 *
 * Only fields whose value really changes are recorded. JSON.stringify gives a
 * cheap deep comparison that also works for arrays, dates and ObjectIds.
 * The diff is stored on req._auditChanges, which the audit() wrapper above
 * picks up when the controller calls res.json.
 */
export const trackChanges = (req, originalDoc, updatedFields) => {
    req._auditChanges ??= [];
    for (const [field, newValue] of Object.entries(updatedFields)) {
        if (newValue === undefined) continue;
        const oldValue = originalDoc[field];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            req._auditChanges.push({ field, oldValue: oldValue ?? null, newValue: newValue ?? null });
        }
    }
};
