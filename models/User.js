const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC INFORMATION
    // =========================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // External ID from imported dataset
    externalId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // ROLE
    // =========================

    role: {
      type: String,
      enum: ["donor", "ngo", "volunteer", "admin"],
      default: "donor",
    },

    // =========================
    // ADDRESS / LOCATION
    // =========================

    address: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },

    // =========================
    // EMAIL VERIFICATION
    // =========================

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // =========================
    // NGO / VOLUNTEER VERIFICATION
    // =========================

    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },

    // =========================
    // BLOCK STATUS
    // =========================

    isBlocked: {
      type: Boolean,
      default: false,
    },

    // =========================
    // PROFILE
    // =========================

    profileImage: {
      type: String,
      default: "",
    },

    // =========================
    // NGO INFORMATION
    // =========================

    organizationName: {
      type: String,
      trim: true,
      default: "",
    },

    organizationDescription: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // VOLUNTEER INFORMATION
    // =========================

    availability: {
      type: Boolean,
      default: true,
    },

    // =========================
    // ACCOUNT STATUS
    // =========================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// =========================
// GEO LOCATION INDEX
// =========================

userSchema.index({
  location: "2dsphere",
});

// =========================
// MODEL
// =========================

const User = mongoose.model("User", userSchema);

module.exports = User;