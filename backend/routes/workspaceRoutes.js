const express = require("express");

const {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  getMyWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  verifyWorkspace,
} = require("../controllers/workspaceController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", getWorkspaces);

router.get("/mine", protect, authorizeRoles("owner"), getMyWorkspaces);

router.get("/:id", getWorkspaceById);

router.post(
  "/",
  protect,
  authorizeRoles("owner"),
  createWorkspace
);

router.put(
  "/:id",
  protect,
  authorizeRoles("owner"),
  updateWorkspace
);

router.delete(
  "/:id",
  protect,
  authorizeRoles("owner"),
  deleteWorkspace
);

router.patch(
  "/:id/verify",
  protect,
  authorizeRoles("admin"),
  verifyWorkspace
);

module.exports = router;
