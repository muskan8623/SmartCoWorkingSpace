const express = require("express");

const {
  initializeAvailability,
  getAvailability,
  updateAvailability,
} = require("../controllers/availabilityController");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
  "/:workspaceId/initialize",
  protect,
  authorizeRoles("owner"),
  initializeAvailability
);

router.get(
  "/:workspaceId",
  getAvailability
);

router.patch(
  "/:workspaceId",
  protect,
  authorizeRoles("owner"),
  updateAvailability
);

module.exports = router;