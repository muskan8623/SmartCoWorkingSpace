const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Workspace owner is required."],
      index: true,
    },

    name: {
      type: String,
      required: [true, "Workspace name is required."],
      trim: true,
      minlength: [2, "Workspace name must contain at least 2 characters."],
      maxlength: [150, "Workspace name cannot exceed 150 characters."],
    },

    description: {
      type: String,
      required: [true, "Workspace description is required."],
      trim: true,
      minlength: [20, "Description must contain at least 20 characters."],
      maxlength: [3000, "Description cannot exceed 3000 characters."],
    },

    workspaceType: {
      type: String,
      required: [true, "Workspace type is required."],
      enum: {
        values: [
          "private_cabin",
          "shared_desk",
          "meeting_room",
          "conference_room",
          "dedicated_desk",
          "hot_desk",
          "virtual_office",
          "event_space",
        ],
        message: "Invalid workspace type.",
      },
    },

    location: {
      address: {
        type: String,
        required: [true, "Workspace address is required."],
        trim: true,
        maxlength: 500,
      },

      city: {
        type: String,
        required: [true, "Workspace city is required."],
        trim: true,
        maxlength: 100,
        index: true,
      },

      state: {
        type: String,
        required: [true, "Workspace state is required."],
        trim: true,
        maxlength: 100,
      },

      country: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default: "India",
      },

      pincode: {
        type: String,
        trim: true,
        maxlength: 20,
      },

      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null,
      },

      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null,
      },
    },

    area: {
      value: {
        type: Number,
        required: [true, "Workspace area is required."],
        min: [1, "Workspace area must be greater than 0."],
      },

      unit: {
        type: String,
        enum: ["sq_ft", "sq_m"],
        default: "sq_ft",
      },
    },

    capacity: {
      type: Number,
      required: [true, "Workspace capacity is required."],
      min: [1, "Workspace capacity must be at least 1."],
      max: [10000, "Workspace capacity is too large."],
      index: true,
    },

    pricing: {
      amount: {
        type: Number,
        required: [true, "Workspace price is required."],
        min: [0, "Workspace price cannot be negative."],
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
        trim: true,
        maxlength: 10,
      },

      billingPeriod: {
        type: String,
        enum: ["hour", "day", "week", "month"],
        default: "month",
      },
    },

    amenities: {
      type: [String],
      default: [],
    },

    images: {
      type: [String],
      default: [],
    },

    availability: {
      type: String,
      enum: ["available", "limited", "unavailable"],
      default: "available",
      index: true,
    },

    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    verificationNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

workspaceSchema.index({
  "location.city": 1,
  capacity: 1,
  "pricing.amount": 1,
});

workspaceSchema.index({
  workspaceType: 1,
  isActive: 1,
  isVerified: 1,
});

module.exports = mongoose.model("Workspace", workspaceSchema);
