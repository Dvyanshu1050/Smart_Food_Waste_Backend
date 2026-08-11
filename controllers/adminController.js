const User = require("../models/User");
const Donation = require("../models/Donation");

// =====================================================
// SOCKET HELPER
// =====================================================

const emitUserEvent = (req, event, user) => {
  const io = req.app.get("io");

  if (!io) {
    console.log("Socket.IO instance not found");
    return;
  }

  io.emit(event, user);
};

// =====================================================
// GET ALL USERS
// =====================================================

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });

  } catch (error) {
    console.error(
      "Get Users Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// BLOCK / UNBLOCK USER
// =====================================================

const toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =================================================
    // ADMIN KO BLOCK NAHI KARNA
    // =================================================

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin cannot be blocked",
      });
    }

    // =================================================
    // TOGGLE BLOCK
    // =================================================

    user.isBlocked = !user.isBlocked;

    await user.save();

    // =================================================
    // SOCKET EVENT
    // =================================================

    emitUserEvent(
      req,
      "user:block_status_changed",
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        isEmailVerified:
          user.isEmailVerified,
        verificationStatus:
          user.verificationStatus,
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      message: user.isBlocked
        ? "User blocked successfully"
        : "User unblocked successfully",

      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
        isEmailVerified:
          user.isEmailVerified,
        verificationStatus:
          user.verificationStatus,
      },
    });

  } catch (error) {
    console.error(
      "Toggle user block error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update user status",
    });
  }
};

// =====================================================
// DELETE USER
// =====================================================

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =================================================
    // ADMIN DELETE NAHI KAR SAKTE
    // =================================================

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Admin account cannot be deleted",
      });
    }

    // =================================================
    // DELETE
    // =================================================

    await User.findByIdAndDelete(id);

    // =================================================
    // SOCKET EVENT
    // =================================================

    emitUserEvent(
      req,
      "user:deleted",
      {
        _id: id,
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,
      message:
        "User deleted successfully",
    });

  } catch (error) {
    console.error(
      "Delete User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// APPROVE NGO / VOLUNTEER
// =====================================================

const approveUserVerification = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    // =================================================
    // USER CHECK
    // =================================================

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =================================================
    // ROLE CHECK
    // =================================================

    if (
      user.role !== "ngo" &&
      user.role !== "volunteer"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only NGO or volunteer accounts can be verified",
      });
    }

    // =================================================
    // ALREADY VERIFIED
    // =================================================

    if (
      user.verificationStatus ===
      "VERIFIED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "User is already verified",
      });
    }

    // =================================================
    // APPROVE
    // =================================================

    user.verificationStatus =
      "VERIFIED";

    // =================================================
    // EMAIL VERIFICATION REMOVED
    // =================================================
    // Resend / OTP is no longer used.
    // Keep this true for compatibility
    // with old users in the database.

    user.isEmailVerified = true;

    await user.save();

    // =================================================
    // UPDATED USER
    // =================================================

    const updatedUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,

      isEmailVerified:
        user.isEmailVerified,

      verificationStatus:
        user.verificationStatus,

      createdAt: user.createdAt,
    };

    // =================================================
    // SOCKET EVENT
    // =================================================

    emitUserEvent(
      req,
      "user:verification_updated",
      updatedUser
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      message:
        "User approved successfully",

      user: updatedUser,
    });

  } catch (error) {
    console.error(
      "Approve Verification Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve user",
    });
  }
};

// =====================================================
// REJECT NGO / VOLUNTEER
// =====================================================

const rejectUserVerification = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    // =================================================
    // USER CHECK
    // =================================================

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // =================================================
    // ROLE CHECK
    // =================================================

    if (
      user.role !== "ngo" &&
      user.role !== "volunteer"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only NGO or volunteer accounts can be rejected",
      });
    }

    // =================================================
    // REJECT
    // =================================================

    user.verificationStatus =
      "REJECTED";

    await user.save();

    // =================================================
    // UPDATED USER
    // =================================================

    const updatedUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked,

      isEmailVerified:
        user.isEmailVerified,

      verificationStatus:
        user.verificationStatus,

      createdAt: user.createdAt,
    };

    // =================================================
    // SOCKET EVENT
    // =================================================

    emitUserEvent(
      req,
      "user:verification_updated",
      updatedUser
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      message:
        "User verification rejected",

      user: updatedUser,
    });

  } catch (error) {
    console.error(
      "Reject Verification Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reject user",
    });
  }
};

// =====================================================
// GET ALL DONATIONS
// =====================================================

const getAllDonations = async (
  req,
  res
) => {
  try {
    const donations =
      await Donation.find()
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
      "Get All Donations Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

const getDashboardStats = async (
  req,
  res
) => {
  try {
    const [
      totalDonations,
      deliveredDonations,
      availableDonations,
      claimedDonations,
      pickedUpDonations,

      totalUsers,
      totalDonors,
      totalNGOs,
      totalVolunteers,
    ] = await Promise.all([
      // ===============================
      // DONATIONS
      // ===============================

      Donation.countDocuments(),

      Donation.countDocuments({
        status: "DELIVERED",
      }),

      Donation.countDocuments({
        status: "AVAILABLE",
      }),

      Donation.countDocuments({
        status: "CLAIMED",
      }),

      Donation.countDocuments({
        status: "PICKED_UP",
      }),

      // ===============================
      // USERS
      // ===============================

      User.countDocuments(),

      User.countDocuments({
        role: "donor",
      }),

      User.countDocuments({
        role: "ngo",
      }),

      User.countDocuments({
        role: "volunteer",
      }),
    ]);

    // =================================================
    // DELIVERY PERCENTAGE
    // =================================================

    const deliveryPercentage =
      totalDonations > 0
        ? Number(
            (
              (deliveredDonations /
                totalDonations) *
              100
            ).toFixed(2)
          )
        : 0;

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      stats: {
        totalDonations,
        deliveredDonations,
        availableDonations,
        claimedDonations,
        pickedUpDonations,

        totalUsers,
        totalDonors,
        totalNGOs,
        totalVolunteers,

        deliveryPercentage,
      },
    });

  } catch (error) {
    console.error(
      "Dashboard Stats Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getAllUsers,
  toggleUserBlock,
  deleteUser,
  approveUserVerification,
  rejectUserVerification,
  getAllDonations,
  getDashboardStats,
};