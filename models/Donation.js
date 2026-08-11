const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    // =========================
    // DONOR
    // =========================

    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =========================
    // FOOD INFORMATION
    // =========================

    foodType: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "cooked-meals",
        "grains",
        "vegetables",
        "fruits",
        "bakery",
        "packaged",
        "other",
      ],
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: {
      type: String,
      required: true,
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
    // PICKUP LOCATION
    // =========================

    pickupLocation: {
      type: String,
      required: true,
      trim: true,
    },

    // Donor Latitude
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    // Donor Longitude
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },

    // =========================
    // DELIVERY LOCATION
    // =========================
    // NGO claim ke baad destination
    // yahan save kiya jayega.

    deliveryLocation: {
      type: String,
      trim: true,
      default: "",
    },

    // Beneficiary / Delivery Latitude
    deliveryLatitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },

    // Beneficiary / Delivery Longitude
    deliveryLongitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },

    // =========================
    // TIME
    // =========================

    pickupTime: {
      type: Date,
      required: true,
    },

    expiryTime: {
      type: Date,
      required: true,
    },

    // =========================
    // DESCRIPTION
    // =========================

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // DONATION STATUS
    // =========================

    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "CLAIMED",
        "PICKED_UP",
        "DELIVERED",
      ],
      default: "AVAILABLE",
    },

    // =========================
    // CLAIM INFORMATION
    // =========================

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    // =========================
    // PICKUP / DELIVERY TIME
    // =========================

    pickedUpAt: {
      type: Date,
      default: null,
    },

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
// MODEL
// =====================================================

const Donation = mongoose.model(
  "Donation",
  donationSchema
);

module.exports = Donation;