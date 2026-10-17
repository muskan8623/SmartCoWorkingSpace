const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    teamSize: {
      type: Number,
      required: true,
      min: 1,
    },

    bookingDate: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    durationHours: {
      type: Number,
      required: true,
      min: 1,
    },

    purpose: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "completed"],
      default: "pending",
    },

    ownerNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({
  workspace: 1,
  bookingDate: 1,
  status: 1,
});

bookingSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Booking", bookingSchema);