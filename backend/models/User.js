const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters."],
      maxlength: [100, "Name cannot exceed 100 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, "Email cannot exceed 255 characters."],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address.",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must contain at least 8 characters."],
      select: false,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters."],
    },

    role: {
      type: String,
      enum: {
        values: ["user", "owner", "admin"],
        message: "Invalid user role.",
      },
      default: "user",
      required: true,
    },

    profileImage: {
      type: String,
      default: null,
      trim: true,
    },

    location: {
      city: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      state: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      country: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "India",
      },
    },

    preferences: {
      teamSize: {
        type: Number,
        min: [1, "Team size must be at least 1."],
        max: [10000, "Team size is too large."],
        default: null,
      },

      requiredArea: {
        type: Number,
        min: [1, "Required area must be greater than 0."],
        default: null,
      },

      maximumBudget: {
        type: Number,
        min: [0, "Budget cannot be negative."],
        default: null,
      },

      preferredWorkspaceType: {
        type: String,
        enum: [
          "private_cabin",
          "shared_desk",
          "meeting_room",
          "conference_room",
          "dedicated_desk",
          null,
        ],
        default: null,
      },

      preferredAmenities: {
        type: [String],
        default: [],
      },

      preferredLocation: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


userSchema.index({ role: 1 });
userSchema.index({ "location.city": 1 });

module.exports = mongoose.model("User", userSchema);


