const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/userController");

const router = express.Router();

// Get logged-in user's profile
router.get(
  "/profile",
  protect,
  getMyProfile
);

// Update logged-in user's profile
router.patch(
  "/profile",
  protect,
  updateMyProfile
);

module.exports = router;
