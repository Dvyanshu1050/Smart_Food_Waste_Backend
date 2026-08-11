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

    // =========================
    // ROLE
    // =========================

    role: {
      type: String,
      enum: ["donor", "ngo", "volunteer", "admin"],
      default: "donor",
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
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;