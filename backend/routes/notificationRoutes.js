const express = require("express");

const {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Get logged-in user's notifications
router.get(
  "/",
  protect,
  getMyNotifications
);

// Mark one notification as read
router.patch(
  "/:id/read",
  protect,
  markNotificationAsRead
);

// Mark all notifications as read
router.patch(
  "/read-all",
  protect,
  markAllNotificationsAsRead
);

// Delete one notification
router.delete(
  "/:id",
  protect,
  deleteNotification
);

module.exports = router;