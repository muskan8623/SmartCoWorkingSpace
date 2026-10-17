const express = require("express");

const {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  approveBooking,
  rejectBooking,
  cancelBooking,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// User routes
router.post(
  "/",
  protect,
  authorizeRoles("user"),
  createBooking
);

router.get(
  "/mine",
  protect,
  authorizeRoles("user"),
  getMyBookings
);

router.patch(
  "/:id/cancel",
  protect,
  authorizeRoles("user"),
  cancelBooking
);

// Owner routes
router.get(
  "/owner",
  protect,
  authorizeRoles("owner"),
  getOwnerBookings
);

router.patch(
  "/:id/approve",
  protect,
  authorizeRoles("owner"),
  approveBooking
);

router.patch(
  "/:id/reject",
  protect,
  authorizeRoles("owner"),
  rejectBooking
);

module.exports = router;