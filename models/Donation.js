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
      index: true,
    },

    // External ID from imported dataset
    externalId: {
      type: String,
      trim: true,
      default: "",
      index: true, // <-- Index is defined here, which is perfect.
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
      enum: ["meals", "kg", "liters", "packets", "boxes"],
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

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },

    // =========================
    // GEOJSON PICKUP LOCATION
    // =========================

    pickupCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    // =========================
    // DELIVERY LOCATION
    // =========================

    deliveryLocation: {
      type: String,
      trim: true,
      default: "",
    },

    deliveryLatitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },

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
      index: true,
    },

    // =========================
    // CLAIM INFORMATION
    // =========================

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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

// =========================
// GEO LOCATION INDEX
// =========================

donationSchema.index({
  pickupCoordinates: "2dsphere",
});

// =========================
// USEFUL QUERY INDEXES
// =========================

donationSchema.index({
  status: 1,
  createdAt: -1,
});

donationSchema.index({
  donor: 1,
  createdAt: -1,
});

donationSchema.index({
  claimedBy: 1,
  status: 1,
});

// ❌ Removed the duplicate externalId index from here!

// =========================
// MODEL
// =========================

const Donation = mongoose.model(
  "Donation",
  donationSchema
);

module.exports = Donation;