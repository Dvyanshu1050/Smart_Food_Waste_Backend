const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/userController");

const router = express.Router();

// =====================================================
// GET LOGGED-IN USER PROFILE
// GET /api/users/profile
// =====================================================

router.get(
  "/profile",
  protect,
  getMyProfile
);

// =====================================================
// UPDATE LOGGED-IN USER PROFILE
// PATCH /api/users/profile
// =====================================================

router.patch(
  "/profile",
  protect,
  updateMyProfile
);

module.exports = router;