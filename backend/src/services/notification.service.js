/**
 * FILE: backend/src/services/notification.service.js
 *
 * PURPOSE
 *   The ONLY place Notification documents are created. Each exported function
 *   represents one kind of event and decides WHO is notified and WHAT text they see:
 *     notifyTaskAssigned       new assignees
 *     notifyTaskStatusChanged  assignees + watchers + reporter
 *     notifyCommentAdded       mentioned users ("mentioned you") + followers ("commented")
 *     notifySprintEvent        every project member (sprint started/completed)
 *     notifyProjectInvitation  the invitee
 *     notifyProjectDeleted     every former member
 *   The actor (the person who acted) is never notified about their own action.
 *
 * WHY A "SERVICE" LAYER
 *   Controllers handle HTTP; this module holds reusable business logic that
 *   several controllers share (task, comment, sprint, project).
 *
 * In-app notifications.
 *
 * Controllers call these functions directly after a successful write:
 *
 *     notifyTaskAssigned(task, newAssigneeIds, req.user);   // no await
 *
 * Why direct calls and not an event bus: this app is a single process, so an
 * EventEmitter added indirection without decoupling anything, and its failure
 * mode was invisible. The previous handlers were registered by importing a
 * file that nothing imported, so every event had zero listeners and no
 * notification was ever created. A function call cannot silently go nowhere.
 *
 * Every function is fire-and-forget: it never throws and never rejects. A
 * failed notification is logged but must not fail the user's request, since the
 * task update itself already succeeded. If notifications ever need retries or
 * multiple app instances, these functions are the seam where a job queue
 * would go, with no controller changes.
 */
import { Notification } from "../models/notification.models.js";
import { NotificationTypeEnum } from "../utils/constants.js";
import logger from "../utils/logger.js";

// Normalises a populated document, an ObjectId or a string to an id string.
const idOf = (value) => (value?._id ?? value)?.toString();

/** Unique recipient ids, excluding the person who caused the event. */
export const recipientsExcept = (ids, actorId) => {
    const actor = idOf(actorId);
    return [...new Set(ids.map(idOf).filter(Boolean))].filter((id) => id !== actor);
};

// Writes one notification per recipient. Errors are caught and logged here,
// which is what makes every exported function safe to call without awaiting.
const send = async (recipients, fields) => {
    if (recipients.length === 0) return;
    try {
        // One round trip for N recipients instead of N inserts.
        await Notification.insertMany(recipients.map((recipient) => ({ recipient, ...fields })));
    } catch (err) {
        logger.error(`Notification write failed (${fields.type})`, { err });
    }
};

// Fields shared by every task-related notification (the link back to the task).
const taskFields = (task, actor) => ({
    entityType: "task",
    entityId: task._id,
    project: idOf(task.project),
    actor: actor._id,
    body: task.title,
});

export const notifyTaskAssigned = (task, assigneeIds, actor) =>
    send(recipientsExcept(assigneeIds, actor._id), {
        type: NotificationTypeEnum.TASK_ASSIGNED,
        title: `${actor.fullName} assigned you to ${task.issueKey}`,
        ...taskFields(task, actor),
    });

export const notifyTaskStatusChanged = (task, from, to, actor) =>
    send(recipientsExcept([...task.assignees, ...task.watchers, task.reporter], actor._id), {
        type: NotificationTypeEnum.TASK_STATUS_CHANGED,
        title: `${actor.fullName} moved ${task.issueKey} from ${from} to ${to}`,
        ...taskFields(task, actor),
    });

export const notifyCommentAdded = (task, mentionedIds, actor) => {
    const mentioned = recipientsExcept(mentionedIds, actor._id);
    const followers = recipientsExcept([...task.assignees, ...task.watchers, task.reporter], actor._id)
        .filter((id) => !mentioned.includes(id)); // a mention already notifies them

    return Promise.all([
        send(mentioned, {
            type: NotificationTypeEnum.COMMENT_MENTIONED,
            title: `${actor.fullName} mentioned you on ${task.issueKey}`,
            ...taskFields(task, actor),
        }),
        send(followers, {
            type: NotificationTypeEnum.COMMENT_ADDED,
            title: `${actor.fullName} commented on ${task.issueKey}`,
            ...taskFields(task, actor),
        }),
    ]);
};

export const notifySprintEvent = (type, sprint, project, actor) =>
    send(recipientsExcept(project.members.map((m) => m.user), actor._id), {
        type,
        title: `${actor.fullName} ${type === NotificationTypeEnum.SPRINT_STARTED ? "started" : "completed"} ${sprint.name}`,
        entityType: "sprint",
        entityId: sprint._id,
        project: project._id,
        actor: actor._id,
    });

export const notifyProjectInvitation = (project, inviteeId, actor) =>
    send(recipientsExcept([inviteeId], actor._id), {
        type: NotificationTypeEnum.MEMBER_INVITED,
        title: `${actor.fullName} invited you to ${project.name}`,
        entityType: "project",
        entityId: project._id,
        project: project._id,
        actor: actor._id,
    });

export const notifyProjectDeleted = (project, actor) =>
    send(recipientsExcept(project.members.map((m) => m.user), actor._id), {
        type: NotificationTypeEnum.PROJECT_DELETED,
        title: `Project "${project.name}" was deleted`,
        body: `Deleted by ${actor.fullName || actor.username}`,
        entityType: "project",
        entityId: project._id,
        actor: actor._id,
    });
