const Booking = require("../models/Booking");
const Workspace = require("../models/Workspace");
const Availability = require("../models/Availability");
const { getIO } = require("../config/socket");
const { createNotification } = require("../services/notificationService");

// Create a new booking request
const createBooking = async (req, res) => {
  try {
    const {
      workspaceId,
      teamSize,
      bookingDate,
      startTime,
      endTime,
      durationHours,
      purpose,
    } = req.body;

    if (
      !workspaceId ||
      !teamSize ||
      !bookingDate ||
      !startTime ||
      !endTime ||
      !durationHours
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Workspace, team size, booking date, start time, end time, and duration are required.",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isActive: true,
      isVerified: true,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Verified workspace not found.",
      });
    }

    const requestedTeamSize = Number(teamSize);

    if (requestedTeamSize > workspace.capacity) {
      return res.status(400).json({
        success: false,
        message: `Team size cannot exceed workspace capacity of ${workspace.capacity}.`,
      });
    }

    const availability = await Availability.findOne({
      workspace: workspaceId,
    });

    if (!availability) {
      return res.status(400).json({
        success: false,
        message: "Workspace availability has not been initialized.",
      });
    }

    if (
      availability.availableCapacity < requestedTeamSize ||
      availability.status === "full" ||
      availability.status === "closed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Workspace does not currently have enough availability.",
        data: {
          availableCapacity: availability.availableCapacity,
          requestedTeamSize,
          status: availability.status,
        },
      });
    }

    const booking = await Booking.create({
      workspace: workspaceId,
      user: req.user._id,
      teamSize: requestedTeamSize,
      bookingDate,
      startTime,
      endTime,
      durationHours: Number(durationHours),
      purpose: purpose || "",
      status: "pending",
    });

    await createNotification({
      recipient: workspace.owner,
      type: "booking_created",
      title: "New Booking Request",
      message: `${req.user.name} has requested a booking for ${workspace.name}.`,
      booking: booking._id,
      workspace: workspace._id,
   });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("workspace", "name workspaceType location pricing capacity")
      .populate("user", "name email phone");

    return res.status(201).json({
      success: true,
      message: "Booking request created successfully.",
      data: {
        booking: populatedBooking,
      },
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create booking request.",
    });
  }
};


// Get logged-in user's bookings
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user._id,
    })
      .populate(
        "workspace",
        "name workspaceType location pricing capacity"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Your bookings retrieved successfully.",
      data: {
        bookings,
      },
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve bookings.",
    });
  }
};


// Get bookings for owner's workspace
const getOwnerBookings = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      owner: req.user._id,
    }).select("_id");

    const workspaceIds = workspaces.map((workspace) => workspace._id);

    const bookings = await Booking.find({
      workspace: { $in: workspaceIds },
    })
      .populate("workspace", "name workspaceType location pricing capacity")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Workspace bookings retrieved successfully.",
      data: {
        bookings,
      },
    });
  } catch (error) {
    console.error("Get owner bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve workspace bookings.",
    });
  }
};


// Approve a booking
const approveBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerNote } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const workspace = await Workspace.findById(booking.workspace);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this booking.",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be approved because its current status is ${booking.status}.`,
      });
    }

    const availability = await Availability.findOne({
      workspace: booking.workspace,
    });

    if (!availability) {
      return res.status(400).json({
        success: false,
        message: "Workspace availability record not found.",
      });
    }

    if (
      availability.availableCapacity < booking.teamSize ||
      availability.status === "full" ||
      availability.status === "closed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Not enough available capacity to approve this booking.",
        data: {
          availableCapacity: availability.availableCapacity,
          requestedTeamSize: booking.teamSize,
          status: availability.status,
        },
      });
    }

    booking.status = "approved";
    booking.ownerNote = ownerNote || "";

    await booking.save();
    await createNotification({
        recipient: booking.user,
        type: "booking_approved",
        title: "Booking Approved",
        message: `Your booking for ${workspace.name} has been approved.`,
        booking: booking._id,
        workspace: workspace._id,
     });

    const occupiedCapacity =
      availability.occupiedCapacity + booking.teamSize;

    const availableCapacity =
      availability.totalCapacity - occupiedCapacity;

    let status = "available";

    if (availableCapacity <= 0) {
      status = "full";
    } else if (
      occupiedCapacity / availability.totalCapacity >= 0.75
    ) {
      status = "limited";
    }

    availability.occupiedCapacity = occupiedCapacity;
    availability.availableCapacity = Math.max(availableCapacity, 0);
    availability.status = status;
    availability.lastUpdatedBy = req.user._id;
    availability.lastUpdatedAt = new Date();

    await availability.save();

    const io = getIO();

    io.to(`workspace:${booking.workspace}`).emit(
      "availabilityUpdated",
      {
        workspaceId: booking.workspace,
        availability,
        reason: "bookingApproved",
      }
    );

    const populatedBooking = await Booking.findById(booking._id)
      .populate("workspace", "name workspaceType location pricing capacity")
      .populate("user", "name email phone");

    return res.status(200).json({
      success: true,
      message: "Booking approved successfully.",
      data: {
        booking: populatedBooking,
        availability,
      },
    });
  } catch (error) {
    console.error("Approve booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve booking.",
    });
  }
};


// Reject a booking
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const workspace = await Workspace.findById(booking.workspace);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this booking.",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be rejected because its current status is ${booking.status}.`,
      });
    }

    booking.status = "rejected";
    booking.rejectionReason = rejectionReason || "Rejected by workspace owner.";

    await booking.save();

    await createNotification({
       recipient: booking.user,
       type: "booking_rejected",
       title: "Booking Rejected",
       message: `Your booking for ${workspace.name} was rejected.`,
       booking: booking._id,
       workspace: workspace._id,
      });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("workspace", "name workspaceType location pricing capacity")
      .populate("user", "name email phone");

    return res.status(200).json({
      success: true,
      message: "Booking rejected successfully.",
      data: {
        booking: populatedBooking,
      },
    });
  } catch (error) {
    console.error("Reject booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject booking.",
    });
  }
};


// Cancel user's booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking.",
      });
    }

    if (!["pending", "approved"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be cancelled because its current status is ${booking.status}.`,
      });
    }

    const wasApproved = booking.status === "approved";

    booking.status = "cancelled";

    await booking.save();
    
    const workspace = await Workspace.findById(booking.workspace);

    if (workspace) {
    await createNotification({
    recipient: workspace.owner,
    type: "booking_cancelled",
    title: "Booking Cancelled",
    message: `${req.user.name} cancelled their booking for ${workspace.name}.`,
    booking: booking._id,
    workspace: workspace._id,
  });
}

    let availability = null;

    if (wasApproved) {
      availability = await Availability.findOne({
        workspace: booking.workspace,
      });

      if (availability) {
        const occupiedCapacity = Math.max(
          availability.occupiedCapacity - booking.teamSize,
          0
        );

        const availableCapacity =
          availability.totalCapacity - occupiedCapacity;

        let status = "available";

        if (availableCapacity <= 0) {
          status = "full";
        } else if (
          occupiedCapacity / availability.totalCapacity >= 0.75
        ) {
          status = "limited";
        }

        availability.occupiedCapacity = occupiedCapacity;
        availability.availableCapacity = Math.max(
          availableCapacity,
          0
        );
        availability.status = status;
        availability.lastUpdatedBy = req.user._id;
        availability.lastUpdatedAt = new Date();

        await availability.save();

        const io = getIO();

        io.to(`workspace:${booking.workspace}`).emit(
          "availabilityUpdated",
          {
            workspaceId: booking.workspace,
            availability,
            reason: "bookingCancelled",
          }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      data: {
        booking,
        availability,
      },
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking.",
    });
  }
};


module.exports = {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  approveBooking,
  rejectBooking,
  cancelBooking,
};