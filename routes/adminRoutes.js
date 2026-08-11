const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAllUsers,
  toggleUserBlock,
  deleteUser,
  approveUserVerification,
  rejectUserVerification,
  getAllDonations,
  getDashboardStats,
} = require("../controllers/adminController");

const router = express.Router();

// =========================
// ALL ADMIN ROUTES
// =========================
// 1. Valid JWT
// 2. Admin role

// =========================
// DASHBOARD STATISTICS
// =========================

router.get(
  "/stats",
  protect,
  authorizeRoles("admin"),
  getDashboardStats
);

// =========================
// MANAGE USERS
// =========================

// Get all users
router.get(
  "/users",
  protect,
  authorizeRoles("admin"),
  getAllUsers
);

// Block / Unblock user
router.patch(
  "/users/:id/block",
  protect,
  authorizeRoles("admin"),
  toggleUserBlock
);

// Delete user
router.delete(
  "/users/:id",
  protect,
  authorizeRoles("admin"),
  deleteUser
);

// =========================
// NGO / VOLUNTEER VERIFICATION
// =========================

// Approve NGO / Volunteer
router.patch(
  "/users/:id/approve",
  protect,
  authorizeRoles("admin"),
  approveUserVerification
);

// Reject NGO / Volunteer
router.patch(
  "/users/:id/reject",
  protect,
  authorizeRoles("admin"),
  rejectUserVerification
);

// =========================
// MANAGE DONATIONS
// =========================

router.get(
  "/donations",
  protect,
  authorizeRoles("admin"),
  getAllDonations
);

module.exports = router;