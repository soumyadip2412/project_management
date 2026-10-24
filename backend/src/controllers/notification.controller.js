/**
 * FILE: backend/src/controllers/notification.controller.js
 *
 * PURPOSE
 *   Read side of in-app notifications: list (paginated), unread count (for
 *   the bell badge), mark one or all read. Notifications are CREATED elsewhere,
 *   by services/notification.service.js.
 *
 * PATTERNS
 *   - Promise.all([find, countDocuments]) runs the page query and the total
 *     count in parallel. Both are needed for "page 2 of 7".
 *   - Ownership is enforced by the QUERY (recipient = req.user._id), not by a
 *     separate check, so there is no window between "check" and "use".
 *   - Response shape: { notifications, total, currentPage, totalPages }.
 */
import { Notification } from "../models/notification.models.js";
import { ApiError } from "../utils/api-errors.js";
import { ApiResponse } from "../utils/api-response.js";
import { asynchandler } from "../utils/asynchandler.js";
import { clampPagination } from "../utils/helpers.js";

// Every query filters on recipient = the caller, so a user can only ever see
// or modify their own notifications, whatever id they send.

const getNotifications = asynchandler(async (req, res) => {
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit ?? 20, 100);
    const filter = { recipient: req.user._id };
    // Optional ?isRead=true|false filter. Query strings are text, hence the comparison with "true".
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === "true";

    const [notifications, total] = await Promise.all([
        Notification.find(filter)
            .populate("actor", "fullName username avatar")
            .populate("project", "name key")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Notification.countDocuments(filter),
    ]);

    return res.status(200).json(new ApiResponse(200, {
        notifications,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
    }, "Notifications fetched"));
});

const getUnreadCount = asynchandler(async (req, res) => {
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    return res.status(200).json(new ApiResponse(200, { unreadCount }, "Unread count fetched"));
});

const markAsRead = asynchandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.notificationId, recipient: req.user._id },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true }
    );
    if (!notification) throw new ApiError(404, "Notification not found");

    return res.status(200).json(new ApiResponse(200, notification, "Marked as read"));
});

const markAllAsRead = asynchandler(async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );
    return res.status(200).json(new ApiResponse(200, null, "All notifications marked as read"));
});

export { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
