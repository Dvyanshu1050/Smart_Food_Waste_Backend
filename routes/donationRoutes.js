const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createDonation,
  getAvailableDonations,
  getMyDonations,
  getMyClaims,
  claimDonation,
  setDeliveryLocation,
  pickupDonation,
  deliverDonation,
} = require("../controllers/donationController");

const router = express.Router();

// =====================================================
// DONOR
// =====================================================

// Create donation
router.post(
  "/",
  protect,
  authorizeRoles("donor"),
  createDonation
);

// Get donor's own donations
router.get(
  "/my",
  protect,
  authorizeRoles("donor"),
  getMyDonations
);

// =====================================================
// NGO / VOLUNTEER
// =====================================================

// Get NGO / Volunteer claimed donations
router.get(
  "/my-claims",
  protect,
  authorizeRoles("ngo", "volunteer"),
  getMyClaims
);

// Available donations
router.get(
  "/available",
  protect,
  authorizeRoles("ngo", "volunteer"),
  getAvailableDonations
);

// Claim donation
router.patch(
  "/:id/claim",
  protect,
  authorizeRoles("ngo", "volunteer"),
  claimDonation
);

// =====================================================
// DELIVERY LOCATION
// =====================================================

// Set delivery / beneficiary location
router.patch(
  "/:id/delivery-location",
  protect,
  authorizeRoles("ngo", "volunteer"),
  setDeliveryLocation
);

// =====================================================
// PICKUP
// =====================================================

// Pickup donation
router.patch(
  "/:id/pickup",
  protect,
  authorizeRoles("ngo", "volunteer"),
  pickupDonation
);

// =====================================================
// DELIVER
// =====================================================

// Deliver donation
router.patch(
  "/:id/deliver",
  protect,
  authorizeRoles("ngo", "volunteer"),
  deliverDonation
);

module.exports = router;