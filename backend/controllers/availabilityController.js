const mongoose = require("mongoose");

const Workspace = require("../models/Workspace");
const Availability = require("../models/Availability");
const { getIO } = require("../config/socket");

const calculateStatus = (totalCapacity, occupiedCapacity) => {
  if (occupiedCapacity >= totalCapacity) {
    return "full";
  }

  if (occupiedCapacity === 0) {
    return "available";
  }

  const occupancyPercentage =
    (occupiedCapacity / totalCapacity) * 100;

  if (occupancyPercentage >= 75) {
    return "limited";
  }

  return "available";
};

const initializeAvailability = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      owner: req.user._id,
      isActive: true,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message:
          "Workspace not found or you are not the owner.",
      });
    }

    let availability = await Availability.findOne({
      workspace: workspaceId,
    });

    if (availability) {
      return res.status(200).json({
        success: true,
        message: "Availability already initialized.",
        data: {
          availability,
        },
      });
    }

    availability = await Availability.create({
      workspace: workspaceId,
      totalCapacity: workspace.capacity,
      occupiedCapacity: 0,
      availableCapacity: workspace.capacity,
      status: "available",
      lastUpdatedBy: req.user._id,
      lastUpdatedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Workspace availability initialized successfully.",
      data: {
        availability,
      },
    });
  } catch (error) {
    console.error("Initialize availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to initialize workspace availability.",
    });
  }
};

const getAvailability = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const availability = await Availability.findOne({
      workspace: workspaceId,
    }).populate(
      "workspace",
      "name workspaceType capacity location availability isVerified isActive"
    );

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: "Availability data not found for this workspace.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        availability,
      },
    });
  } catch (error) {
    console.error("Get availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve availability.",
    });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { occupiedCapacity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (
      occupiedCapacity === undefined ||
      occupiedCapacity === null ||
      !Number.isInteger(Number(occupiedCapacity))
    ) {
      return res.status(400).json({
        success: false,
        message: "occupiedCapacity must be an integer.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      owner: req.user._id,
      isActive: true,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message:
          "Workspace not found or you are not the owner.",
      });
    }

    const occupied = Number(occupiedCapacity);

    if (occupied < 0 || occupied > workspace.capacity) {
      return res.status(400).json({
        success: false,
        message:
          `Occupied capacity must be between 0 and ${workspace.capacity}.`,
      });
    }

    const available = workspace.capacity - occupied;

    const status = calculateStatus(
      workspace.capacity,
      occupied
    );

    const availability = await Availability.findOneAndUpdate(
      {
        workspace: workspaceId,
      },
      {
        workspace: workspaceId,
        totalCapacity: workspace.capacity,
        occupiedCapacity: occupied,
        availableCapacity: available,
        status,
        lastUpdatedBy: req.user._id,
        lastUpdatedAt: new Date(),
      },
     {
       returnDocument: "after",
       upsert: true,
       runValidators: true,
      }
    );

    const io = getIO();

io.to(`workspace:${workspaceId}`).emit(
  "availabilityUpdated",
  {
    workspaceId,
    availability,
  }
);

    return res.status(200).json({
      success: true,
      message: "Workspace availability updated successfully.",
      data: {
        availability,
      },
    });
  } catch (error) {
    console.error("Update availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update workspace availability.",
    });
  }
};

module.exports = {
  initializeAvailability,
  getAvailability,
  updateAvailability,
};