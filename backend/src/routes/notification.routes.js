/**
 * FILE: backend/src/routes/notification.routes.js   (mounted at /api/v1/notifications)
 *
 * ENDPOINTS (all about the CALLER's own notifications)
 *   GET  /                          paginated list (newest first)
 *   GET  /unread-count              number for the bell badge
 *   PUT  /read-all                  mark everything read
 *   PUT  /:notificationId/read      mark one read
 *
 * Only verifyJWT: every query in the controller is filtered by
 * recipient = req.user._id, so one user can never touch another's notifications.
 * "/read-all" is declared before "/:notificationId/read"; it would not clash
 * anyway, because the paths differ in length.
 */
import { Router } from "express";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
} from "../controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { objectIdParam } from "../middlewares/validator.middleware.js";

const router = Router();

router.use(verifyJWT);
router.param("notificationId", objectIdParam);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:notificationId/read", markAsRead);

export default router;
