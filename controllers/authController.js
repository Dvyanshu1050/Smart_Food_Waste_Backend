const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// =====================================================
// REGISTER USER
// =====================================================

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required",
      });
    }

    // =================================================
    // NORMALIZE EMAIL
    // =================================================

    const normalizedEmail =
      email.toLowerCase().trim();

    // =================================================
    // PASSWORD VALIDATION
    // =================================================

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }

    // =================================================
    // CHECK EXISTING USER
    // =================================================

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // =================================================
    // ALLOWED ROLES
    // =================================================

    const allowedRoles = [
      "donor",
      "ngo",
      "volunteer",
    ];

    const userRole =
      allowedRoles.includes(role)
        ? role
        : "donor";

    // =================================================
    // HASH PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // =================================================
    // ADMIN VERIFICATION
    // =================================================

    let verificationStatus = "VERIFIED";

    if (
      userRole === "ngo" ||
      userRole === "volunteer"
    ) {
      verificationStatus = "PENDING";
    }

    // =================================================
    // CREATE USER
    // =================================================

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,

      // Email verification removed.
      // Registration itself is considered verified.
      isEmailVerified: true,

      verificationStatus,
    });

    // =================================================
    // REAL-TIME ADMIN UPDATE
    // =================================================

    const io = req.app.get("io");

    if (io) {
      io.emit("user:registered", {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked || false,

        isEmailVerified:
          user.isEmailVerified,

        verificationStatus:
          user.verificationStatus,

        createdAt: user.createdAt,
      });

      console.log(
        "🟢 New user emitted:",
        user.email
      );
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        userRole === "ngo" ||
        userRole === "volunteer"
          ? "Registration successful. Your account is pending admin verification."
          : "Registration successful",

      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,

        isEmailVerified:
          user.isEmailVerified,

        verificationStatus:
          user.verificationStatus,

        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error(
      "Register Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// LOGIN USER
// =====================================================

const loginUser = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    // =================================================
    // NORMALIZE EMAIL
    // =================================================

    const normalizedEmail =
      email.toLowerCase().trim();

    // =================================================
    // FIND USER
    // =================================================

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // =================================================
    // BLOCKED USER
    // =================================================

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been blocked",
      });
    }

    // =================================================
    // NGO / VOLUNTEER ADMIN VERIFICATION
    // =================================================

    if (
      (user.role === "ngo" ||
        user.role === "volunteer") &&
      user.verificationStatus !==
        "VERIFIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is pending admin verification",
      });
    }

    // =================================================
    // PASSWORD CHECK
    // =================================================

    const isPasswordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    // =================================================
    // JWT
    // =================================================

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      }
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,

        isEmailVerified:
          user.isEmailVerified,

        verificationStatus:
          user.verificationStatus,
      },
    });

  } catch (error) {
    console.error(
      "Login Error:",
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
  registerUser,
  loginUser,
};