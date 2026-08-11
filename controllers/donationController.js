const User = require("../models/User");
const Donation = require("../models/Donation");

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
    // VALIDATION
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
    // COORDINATE VALIDATION
    // =========================

    if (
      Number(latitude) < -90 ||
      Number(latitude) > 90 ||
      Number(longitude) < -180 ||
      Number(longitude) > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup coordinates",
      });
    }

    // =========================
    // EXPIRY VALIDATION
    // =========================

    if (new Date(expiryTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Expiry time must be in the future",
      });
    }

    // =========================
    // PICKUP / EXPIRY VALIDATION
    // =========================

    if (new Date(pickupTime) >= new Date(expiryTime)) {
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

      foodType,
      category,
      quantity,
      unit,

      pickupLocation,
      latitude: Number(latitude),
      longitude: Number(longitude),

      pickupTime,
      expiryTime,

      description,
    });

    // =========================
    // POPULATE DONOR
    // =========================

    const populatedDonation =
      await Donation.findById(donation._id)
        .populate("donor", "name email")
        .populate("claimedBy", "name email role");

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

const getAvailableDonations = async (req, res) => {
  try {
    const donations = await Donation.find({
      status: "AVAILABLE",
      expiryTime: {
        $gt: new Date(),
      },
    })
      .populate("donor", "name email")
      .populate("claimedBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: donations.length,
      donations,
    });
  } catch (error) {
    console.error(
      "Get Donations Error:",
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

const getMyDonations = async (req, res) => {
  try {
    const donations = await Donation.find({
      donor: req.user.id,
    })
      .populate("donor", "name email")
      .populate("claimedBy", "name email role")
      .sort({ createdAt: -1 });

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

const claimDonation = async (req, res) => {
  try {
    const { id } = req.params;

    // =========================
    // FIND USER
    // =========================

    const user = await User.findById(
      req.user.id
    );

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
        message: "Your account has been blocked",
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
    // Registration itself verifies email
    // because OTP/Resend was removed.

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

    if (donation.status !== "AVAILABLE") {
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
    // CLAIM
    // =========================

    donation.status = "CLAIMED";
    donation.claimedBy = req.user.id;
    donation.claimedAt = new Date();

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
          "name email"
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
      donation: populatedDonation,
    });
  } catch (error) {
    console.error(
      "Claim Donation Error:",
      error
    );

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
    // REQUIRED FIELDS
    // =========================

    if (
      !deliveryLocation ||
      deliveryLatitude === undefined ||
      deliveryLongitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery location and coordinates are required",
      });
    }

    // =========================
    // COORDINATE VALIDATION
    // =========================

    const lat = Number(
      deliveryLatitude
    );

    const lng = Number(
      deliveryLongitude
    );

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

    if (donation.status !== "CLAIMED") {
      return res.status(400).json({
        success: false,
        message:
          "Delivery location can only be set after claiming and before pickup",
      });
    }

    // =========================
    // SAVE DELIVERY LOCATION
    // =========================

    donation.deliveryLocation =
      deliveryLocation.trim();

    donation.deliveryLatitude = lat;
    donation.deliveryLongitude = lng;

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
          "name email"
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
      donation: populatedDonation,
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

    if (donation.status !== "CLAIMED") {
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
      donation.deliveryLatitude === null ||
      donation.deliveryLongitude === null
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
    // PICKUP
    // =========================

    donation.status = "PICKED_UP";
    donation.pickedUpAt = new Date();

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
          "name email"
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
      "donation:picked_up",
      populatedDonation
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,
      message:
        "Donation marked as picked up",
      donation: populatedDonation,
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

    if (donation.status !== "PICKED_UP") {
      return res.status(400).json({
        success: false,
        message:
          "Donation must be picked up first",
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
      donation.deliveryLatitude === null ||
      donation.deliveryLongitude === null
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

    donation.status = "DELIVERED";
    donation.deliveredAt = new Date();

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
          "name email"
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
      donation: populatedDonation,
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
    const donations =
      await Donation.find({
        claimedBy: req.user.id,
      })
        .populate(
          "donor",
          "name email"
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
      "Get my claims error:",
      error.message
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
  claimDonation,
  setDeliveryLocation,
  pickupDonation,
  deliverDonation,
  getMyClaims,
};