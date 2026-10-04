/**
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

export const audit = (entityType, action) => {
    if (!AvailableEntityTypes.includes(entityType)) {
        throw new Error(`audit(): unknown entity type "${entityType}"`);
    }
    if (!AvailableAuditActions.includes(action)) {
        throw new Error(`audit(): unknown action "${action}"`);
    }

    return (req, res, next) => {
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
