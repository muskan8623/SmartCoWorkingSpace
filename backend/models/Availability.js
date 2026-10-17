const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },

    totalCapacity: {
      type: Number,
      required: true,
      min: 1,
    },

    occupiedCapacity: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableCapacity: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["available", "limited", "full", "closed"],
      default: "available",
    },

    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);


availabilitySchema.index({ status: 1 });

module.exports = mongoose.model("Availability", availabilitySchema);