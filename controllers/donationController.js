const User = require("../models/User");
const Donation = require("../models/Donation");
const Claim = require("../models/Claim");

// =====================================================
// SOCKET HELPER
// =====================================================

const emitDonationEvent = (req, event, donation) => {
  const io = req.app.get("io");

  if (!io) {
    console.log("Socket.IO instance not found");
    return;
  }

  io.emit(event, donation);
};

// =====================================================
// CREATE DONATION
// =====================================================

const createDonation = async (req, res) => {
  try {
    const {
      foodType,
      category,
      quantity,
      unit,
      pickupLocation,
      latitude,
      longitude,
      pickupTime,
      expiryTime,
      description,
    } = req.body;

    // =========================
    // BASIC VALIDATION
    // =========================

    if (
      !foodType ||
      !category ||
      !quantity ||
      !pickupLocation ||
      latitude === undefined ||
      longitude === undefined ||
      !pickupTime ||
      !expiryTime
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    // =========================
    // QUANTITY VALIDATION
    // =========================

    if (Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // =========================
    // COORDINATE VALIDATION
    // =========================

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup coordinates",
      });
    }

    // =========================
    // DATE VALIDATION
    // =========================

    const pickupDate = new Date(pickupTime);
    const expiryDate = new Date(expiryTime);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(expiryDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup or expiry date",
      });
    }

    // =========================
    // EXPIRY VALIDATION
    // =========================

    if (expiryDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry time must be in the future",
      });
    }

    // =========================
    // PICKUP / EXPIRY VALIDATION
    // =========================

    if (pickupDate >= expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Pickup time must be before expiry time",
      });
    }

    // =========================
    // CREATE DONATION
    // =========================

    const donation = await Donation.create({
      donor: req.user.id,

      foodType: foodType.trim(),
      category,
      quantity: Number(quantity),
      unit: unit || "meals",

      pickupLocation: pickupLocation.trim(),

      latitude: lat,
      longitude: lng,

      // GeoJSON
      pickupCoordinates: {
        type: "Point",
        coordinates: [lng, lat],
      },

      pickupTime: pickupDate,
      expiryTime: expiryDate,

      description: description
        ? description.trim()
        : "",
    });

    // =========================
    // POPULATE DONATION
    // =========================

    const populatedDonation =
      await Donation.findById(donation._id)
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        );

    // =========================
    // SOCKET EVENT
    // =========================

    emitDonationEvent(
      req,
      "donation:created",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(201).json({
      success: true,
      message: "Donation created successfully",
      donation: populatedDonation,
    });
  } catch (error) {
    console.error(
      "Create Donation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// GET AVAILABLE DONATIONS
// =====================================================

const getAvailableDonations = async (
  req,
  res
) => {
  try {
    const donations =
      await Donation.find({
        status: "AVAILABLE",

        expiryTime: {
          $gt: new Date(),
        },
      })
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: donations.length,
      donations,
    });
  } catch (error) {
    console.error(
      "Get Available Donations Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// GET MY DONATIONS
// =====================================================

const getMyDonations = async (
  req,
  res
) => {
  try {
    const donations =
      await Donation.find({
        donor: req.user.id,
      })
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: donations.length,
      donations,
    });
  } catch (error) {
    console.error(
      "Get My Donations Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// CLAIM DONATION
// =====================================================

const claimDonation = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // =========================
    // FIND USER
    // =========================

    const user =
      await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =========================
    // BLOCKED USER
    // =========================

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been blocked",
      });
    }

    // =========================
    // ROLE CHECK
    // =========================

    if (
      user.role !== "ngo" &&
      user.role !== "volunteer"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only NGO or volunteer can claim donations",
      });
    }

    // =========================
    // EMAIL VERIFICATION
    // =========================

    if (user.isEmailVerified !== true) {
      return res.status(403).json({
        success: false,
        message:
          "Your account email is not verified",
      });
    }

    // =========================
    // ADMIN VERIFICATION
    // =========================

    if (
      user.verificationStatus !==
      "VERIFIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not verified by admin",
      });
    }

    // =========================
    // FIND DONATION
    // =========================

    const donation =
      await Donation.findById(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    // =========================
    // STATUS CHECK
    // =========================

    if (
      donation.status !== "AVAILABLE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Donation is no longer available",
      });
    }

    // =========================
    // EXPIRY CHECK
    // =========================

    if (
      new Date(donation.expiryTime) <=
      new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Donation has expired",
      });
    }

    // =========================
    // PREVENT DONOR CLAIMING
    // =========================

    if (
      donation.donor.toString() ===
      req.user.id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot claim your own donation",
      });
    }

    // =========================
    // CREATE CLAIM ID
    // =========================

    const claimId =
      `CLM-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;

    // =========================
    // CREATE CLAIM
    // =========================

    const claim =
      await Claim.create({
        claimId,

        donation: donation._id,

        ngo:
          user.role === "ngo"
            ? user._id
            : null,

        volunteer:
          user.role === "volunteer"
            ? user._id
            : null,

        claimedQuantity:
          donation.quantity,

        unit:
          donation.unit || "meals",

        claimedAt: new Date(),

        status: "CLAIMED",

        pickupDistanceKm: 0,

        pickupDelayMin: 0,

        deliveryStatus: "Pending",
      });

    // =========================
    // UPDATE DONATION
    // =========================

    donation.status = "CLAIMED";

    donation.claimedBy =
      user._id;

    donation.claimedAt =
      new Date();

    await donation.save();

    // =========================
    // POPULATE DONATION
    // =========================

    const populatedDonation =
      await Donation.findById(
        donation._id
      )
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        );

    // =========================
    // POPULATE CLAIM
    // =========================

    const populatedClaim =
      await Claim.findById(
        claim._id
      )
        .populate(
          "donation",
          "foodType category quantity unit pickupLocation status"
        )
        .populate(
          "ngo",
          "name email role"
        )
        .populate(
          "volunteer",
          "name email role"
        );

    // =========================
    // SOCKET EVENT
    // =========================

    emitDonationEvent(
      req,
      "donation:claimed",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,
      message:
        "Donation claimed successfully",

      donation:
        populatedDonation,

      claim:
        populatedClaim,
    });
  } catch (error) {
    console.error(
      "Claim Donation Error:",
      error
    );

    // Duplicate claimId / duplicate DB error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This donation has already been claimed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// SET DELIVERY LOCATION
// =====================================================

const setDeliveryLocation = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const {
      deliveryLocation,
      deliveryLatitude,
      deliveryLongitude,
    } = req.body;

    // =========================
    // VALIDATION
    // =========================

    if (
      !deliveryLocation ||
      !deliveryLocation.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery location is required",
      });
    }

    const lat =
      Number(deliveryLatitude);

    const lng =
      Number(deliveryLongitude);

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid delivery coordinates",
      });
    }

    // =========================
    // FIND DONATION
    // =========================

    const donation =
      await Donation.findById(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    // =========================
    // CLAIMANT CHECK
    // =========================

    if (
      !donation.claimedBy ||
      donation.claimedBy.toString() !==
        req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not the claimant of this donation",
      });
    }

    // =========================
    // STATUS CHECK
    // =========================

    if (
      donation.status !== "CLAIMED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery location can only be set after claiming and before pickup",
      });
    }

    // =========================
    // SAVE LOCATION
    // =========================

    donation.deliveryLocation =
      deliveryLocation.trim();

    donation.deliveryLatitude =
      lat;

    donation.deliveryLongitude =
      lng;

    await donation.save();

    // =========================
    // POPULATE
    // =========================

    const populatedDonation =
      await Donation.findById(
        donation._id
      )
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        );

    // =========================
    // SOCKET EVENT
    // =========================

    emitDonationEvent(
      req,
      "donation:delivery-location-updated",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,
      message:
        "Delivery location updated successfully",
      donation:
        populatedDonation,
    });
  } catch (error) {
    console.error(
      "Set Delivery Location Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// PICKUP DONATION
// =====================================================

const pickupDonation = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // =========================
    // FIND DONATION
    // =========================

    const donation =
      await Donation.findById(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    // =========================
    // STATUS CHECK
    // =========================

    if (
      donation.status !== "CLAIMED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Donation must be claimed first",
      });
    }

    // =========================
    // DELIVERY LOCATION CHECK
    // =========================

    if (
      !donation.deliveryLocation ||
      donation.deliveryLatitude ===
        null ||
      donation.deliveryLongitude ===
        null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please set the delivery location before pickup",
      });
    }

    // =========================
    // CLAIMANT CHECK
    // =========================

    if (
      !donation.claimedBy ||
      donation.claimedBy.toString() !==
        req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not the claimant of this donation",
      });
    }

    // =========================
    // UPDATE DONATION
    // =========================

    donation.status =
      "PICKED_UP";

    donation.pickedUpAt =
      new Date();

    await donation.save();

    // =========================
    // UPDATE CLAIM
    // =========================

    const claim =
      await Claim.findOne({
        donation: donation._id,

        $or: [
          {
            ngo: req.user.id,
          },
          {
            volunteer: req.user.id,
          },
        ],
      });

    if (claim) {
      claim.status =
        "PICKED_UP";

      claim.deliveryStatus =
        "Picked Up";

      claim.pickedUpAt =
        donation.pickedUpAt;

      await claim.save();
    }

    // =========================
    // POPULATE
    // =========================

    const populatedDonation =
      await Donation.findById(
        donation._id
      )
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        );

    // =========================
    // SOCKET EVENT
    // =========================

    emitDonationEvent(
      req,
      "donation:picked-up",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,
      message:
        "Donation picked up successfully",

      donation:
        populatedDonation,
    });
  } catch (error) {
    console.error(
      "Pickup Donation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// DELIVER DONATION
// =====================================================

const deliverDonation = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // =========================
    // FIND DONATION
    // =========================

    const donation =
      await Donation.findById(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation not found",
      });
    }

    // =========================
    // STATUS CHECK
    // =========================

    if (
      donation.status !==
      "PICKED_UP"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Donation must be picked up before delivery",
      });
    }

    // =========================
    // CLAIMANT CHECK
    // =========================

    if (
      !donation.claimedBy ||
      donation.claimedBy.toString() !==
        req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to deliver this donation",
      });
    }

    // =========================
    // DELIVERY LOCATION CHECK
    // =========================

    if (
      !donation.deliveryLocation ||
      donation.deliveryLatitude ===
        null ||
      donation.deliveryLongitude ===
        null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery location is not set",
      });
    }

    // =========================
    // DELIVER
    // =========================

    donation.status =
      "DELIVERED";

    donation.deliveredAt =
      new Date();

    await donation.save();

    // =========================
    // UPDATE CLAIM
    // =========================

    const claim =
      await Claim.findOne({
        donation: donation._id,

        $or: [
          {
            ngo: req.user.id,
          },
          {
            volunteer: req.user.id,
          },
        ],
      });

    if (claim) {
      claim.status =
        "DELIVERED";

      claim.deliveryStatus =
        "Delivered";

      claim.deliveredAt =
        donation.deliveredAt;

      await claim.save();
    }

    // =========================
    // POPULATE
    // =========================

    const populatedDonation =
      await Donation.findById(
        donation._id
      )
        .populate(
          "donor",
          "name email role"
        )
        .populate(
          "claimedBy",
          "name email role"
        );

    // =========================
    // SOCKET EVENT
    // =========================

    emitDonationEvent(
      req,
      "donation:delivered",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,
      message:
        "Donation delivered successfully",

      donation:
        populatedDonation,
    });
  } catch (error) {
    console.error(
      "Deliver Donation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// GET MY CLAIMS
// =====================================================

const getMyClaims = async (
  req,
  res
) => {
  try {
    // =========================
    // FIND CLAIMS
    // =========================

    const claims =
      await Claim.find({
        $or: [
          {
            ngo: req.user.id,
          },
          {
            volunteer: req.user.id,
          },
        ],
      })
        .populate(
          "donation"
        )
        .populate(
          "ngo",
          "name email role"
        )
        .populate(
          "volunteer",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    // =========================
    // KEEP OLD FRONTEND FORMAT
    // =========================

    const donations =
      claims
        .filter(
          (claim) =>
            claim.donation
        )
        .map((claim) => {
          const donation =
            claim.donation.toObject();

          return {
            ...donation,

            // Existing frontend fields
            claimId:
              claim.claimId,

            claimStatus:
              claim.status,

            deliveryStatus:
              claim.deliveryStatus,

            claimedQuantity:
              claim.claimedQuantity,

            claimCreatedAt:
              claim.createdAt,
          };
        });

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,

      count:
        donations.length,

      // Existing frontend
      donations,

      // New database structure
      claims,
    });
  } catch (error) {
    console.error(
      "Get My Claims Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch claimed donations",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createDonation,
  getAvailableDonations,
  getMyDonations,
  getMyClaims,
  claimDonation,
  setDeliveryLocation,
  pickupDonation,
  deliverDonation,
};