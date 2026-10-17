const mongoose = require("mongoose");

const Workspace = require("../models/Workspace");

const createWorkspace = async (req, res) => {
  try {
    const {
      name,
      description,
      workspaceType,
      location,
      area,
      capacity,
      pricing,
      amenities,
      images,
      availability,
      operatingHours,
    } = req.body;

    if (!name || !description || !workspaceType) {
      return res.status(400).json({
        success: false,
        message:
          "Name, description, and workspace type are required.",
      });
    }

    if (!location || !location.address || !location.city || !location.state) {
      return res.status(400).json({
        success: false,
        message:
          "Workspace address, city, and state are required.",
      });
    }

    if (!area || area.value === undefined || area.value === null) {
      return res.status(400).json({
        success: false,
        message: "Workspace area is required.",
      });
    }

    if (!capacity) {
      return res.status(400).json({
        success: false,
        message: "Workspace capacity is required.",
      });
    }

    if (!pricing || pricing.amount === undefined || pricing.amount === null) {
      return res.status(400).json({
        success: false,
        message: "Workspace pricing is required.",
      });
    }

    const workspace = await Workspace.create({
      owner: req.user._id,
      name: name.trim(),
      description: description.trim(),
      workspaceType,
      location,
      area,
      capacity,
      pricing,
      amenities: Array.isArray(amenities) ? amenities : [],
      images: Array.isArray(images) ? images : [],
      availability: availability || "available",
      operatingHours: operatingHours || {},
      isVerified: false,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message:
        "Workspace created successfully and submitted for verification.",
      data: {
        workspace,
      },
    });
  } catch (error) {
    console.error("Create workspace error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Workspace validation failed.",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create workspace.",
    });
  }
};

const getWorkspaces = async (req, res) => {
  try {
    const {
      city,
      workspaceType,
      minCapacity,
      maxCapacity,
      minArea,
      maxArea,
      maxBudget,
      availability,
      amenities,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const requestedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {
      isActive: true,
      isVerified: true,
    };

    if (city) {
      filter["location.city"] = {
        $regex: city.trim(),
        $options: "i",
      };
    }

    if (workspaceType) {
      filter.workspaceType = workspaceType;
    }

    if (availability) {
      filter.availability = availability;
    }

    if (minCapacity || maxCapacity) {
      filter.capacity = {};

      if (minCapacity) {
        filter.capacity.$gte = Number(minCapacity);
      }

      if (maxCapacity) {
        filter.capacity.$lte = Number(maxCapacity);
      }
    }

    if (minArea || maxArea) {
      filter["area.value"] = {};

      if (minArea) {
        filter["area.value"].$gte = Number(minArea);
      }

      if (maxArea) {
        filter["area.value"].$lte = Number(maxArea);
      }
    }

    if (maxBudget) {
      filter["pricing.amount"] = {
        $lte: Number(maxBudget),
      };
    }

    if (amenities) {
      const requestedAmenities = amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (requestedAmenities.length > 0) {
        filter.amenities = {
          $all: requestedAmenities,
        };
      }
    }

    const skip = (currentPage - 1) * requestedLimit;

    const [workspaces, total] = await Promise.all([
      Workspace.find(filter)
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(requestedLimit),

      Workspace.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        workspaces,
        pagination: {
          page: currentPage,
          limit: requestedLimit,
          total,
          totalPages: Math.ceil(total / requestedLimit),
        },
      },
    });
  } catch (error) {
    console.error("Get workspaces error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve workspaces.",
    });
  }
};

const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: id,
      isActive: true,
      isVerified: true,
    }).populate("owner", "name email phone");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        workspace,
      },
    });
  } catch (error) {
    console.error("Get workspace by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve workspace.",
    });
  }
};

const getMyWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      owner: req.user._id,
    })
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        workspaces,
      },
    });
  } catch (error) {
    console.error("Get my workspaces error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your workspaces.",
    });
  }
};

const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or you are not the owner.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "workspaceType",
      "location",
      "area",
      "capacity",
      "pricing",
      "amenities",
      "images",
      "availability",
      "operatingHours",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        workspace[field] = req.body[field];
      }
    }

    workspace.isVerified = false;
    workspace.verificationNote =
      "Workspace information was updated and requires re-verification.";
    workspace.verifiedAt = null;
    workspace.verifiedBy = null;

    await workspace.save();

    return res.status(200).json({
      success: true,
      message:
        "Workspace updated successfully and submitted for re-verification.",
      data: {
        workspace,
      },
    });
  } catch (error) {
    console.error("Update workspace error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Workspace validation failed.",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update workspace.",
    });
  }
};

const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or you are not the owner.",
      });
    }

    workspace.isActive = false;
    await workspace.save();

    return res.status(200).json({
      success: true,
      message: "Workspace deactivated successfully.",
    });
  } catch (error) {
    console.error("Delete workspace error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate workspace.",
    });
  }
};

const verifyWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified, verificationNote } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "The verified field must be true or false.",
      });
    }

    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    workspace.isVerified = verified;
    workspace.verificationNote = verificationNote
      ? verificationNote.trim()
      : null;

    workspace.verifiedAt = verified ? new Date() : null;
    workspace.verifiedBy = verified ? req.user._id : null;

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: verified
        ? "Workspace verified successfully."
        : "Workspace verification rejected.",
      data: {
        workspace,
      },
    });
  } catch (error) {
    console.error("Verify workspace error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update workspace verification.",
    });
  }
};

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  getMyWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  verifyWorkspace,
};
