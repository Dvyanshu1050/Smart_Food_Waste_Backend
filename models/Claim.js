const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    // =========================
    // CLAIM ID
    // =========================

    claimId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // =========================
    // DONATION
    // =========================

    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: true,
      index: true,
    },

    // =========================
    // NGO
    // =========================
    // NGO claim kare to yahan User ID save hogi.

    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // =========================
    // VOLUNTEER
    // =========================
    // Volunteer claim kare to yahan User ID save hogi.

    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // =========================
    // CLAIMED QUANTITY
    // =========================

    claimedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // =========================
    // CLAIMED UNIT
    // =========================

    unit: {
      type: String,
      enum: [
        "meals",
        "kg",
        "liters",
        "packets",
        "boxes",
      ],
      default: "meals",
    },

    // =========================
    // CLAIM DATE
    // =========================

    claimedAt: {
      type: Date,
      default: Date.now,
    },

    // =========================
    // CLAIM STATUS
    // =========================

    status: {
      type: String,
      enum: [
        "CLAIMED",
        "ASSIGNED",
        "PICKED_UP",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "CLAIMED",
      index: true,
    },

    // =========================
    // PICKUP INFORMATION
    // =========================

    pickupDistanceKm: {
      type: Number,
      min: 0,
      default: 0,
    },

    pickupDelayMin: {
      type: Number,
      min: 0,
      default: 0,
    },

    // =========================
    // DELIVERY STATUS
    // =========================

    deliveryStatus: {
      type: String,
      enum: [
        "Pending",
        "Picked Up",
        "In Transit",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    // =========================
    // PICKUP TIME
    // =========================

    pickedUpAt: {
      type: Date,
      default: null,
    },

    // =========================
    // DELIVERY TIME
    // =========================

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

// Donation ke claims quickly find karne ke liye
claimSchema.index({
  donation: 1,
  createdAt: -1,
});

// NGO ke claims
claimSchema.index({
  ngo: 1,
  status: 1,
});

// Volunteer ke claims
claimSchema.index({
  volunteer: 1,
  status: 1,
});

// Status based queries
claimSchema.index({
  status: 1,
  createdAt: -1,
});

// Delivery status queries
claimSchema.index({
  deliveryStatus: 1,
  createdAt: -1,
});

// =====================================================
// MODEL
// =====================================================

const Claim = mongoose.model("Claim", claimSchema);

module.exports = Claim;