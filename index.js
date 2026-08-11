const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const donationRoutes = require("./routes/donationRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// =====================================================
// DATABASE
// =====================================================

connectDB();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// =====================================================
// ROUTES
// =====================================================

app.use("/api/auth", authRoutes);

app.use("/api/donations", donationRoutes);

app.use("/api/users", userRoutes);

app.use("/api/admin", adminRoutes);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Food Waste API is running",
  });
});

// =====================================================
// HTTP SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
    ],

    credentials: true,
  },
});

app.set("io", io);

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // ===================================================
  // WELCOME
  // ===================================================

  socket.emit("welcome", {
    message: "Connected to Smart Food Waste real-time server",
  });

  // ===================================================
  // DONOR WATCHES DONATION
  // ===================================================

  socket.on("donation:tracking-watch", ({ donationId }) => {
    if (!donationId) {
      return;
    }

    const room = `donation:${donationId}`;

    socket.join(room);

    console.log(
      `👀 Socket ${socket.id} is watching ${room}`
    );
  });

  // ===================================================
  // START LIVE TRACKING
  // ===================================================

  socket.on("donation:tracking-start", ({ donationId }) => {
    if (!donationId) {
      return;
    }

    const room = `donation:${donationId}`;

    // NGO joins donation room
    socket.join(room);

    console.log(`📍 Tracking started: ${donationId}`);

    console.log(
      `👤 NGO socket ${socket.id} joined ${room}`
    );

    // Notify donor(s) inside the room
    socket.to(room).emit(
      "donation:tracking-started",
      {
        donationId,
      }
    );
  });

  // ===================================================
  // LOCATION UPDATE
  // ===================================================

  socket.on(
    "donation:location-update",
    ({
      donationId,
      latitude,
      longitude,
      accuracy,
    }) => {
      // Validate data
      if (
        !donationId ||
        latitude === undefined ||
        longitude === undefined
      ) {
        return;
      }

      const room = `donation:${donationId}`;

      console.log(
        `📍 Location update for ${donationId}:`,
        latitude,
        longitude,
        `±${Math.round(accuracy || 0)}m`
      );

      // Send live location to everyone else
      // inside this donation room.
      socket.to(room).emit(
        "donation:location-updated",
        {
          donationId,
          latitude,
          longitude,
          accuracy,
        }
      );
    }
  );

  // ===================================================
  // STOP LIVE TRACKING
  // ===================================================

  socket.on("donation:tracking-stop", ({ donationId }) => {
    if (!donationId) {
      return;
    }

    const room = `donation:${donationId}`;

    // Notify donor
    socket.to(room).emit(
      "donation:tracking-stopped",
      {
        donationId,
      }
    );

    // NGO leaves room
    socket.leave(room);

    console.log(`⛔ Tracking stopped: ${donationId}`);
  });

  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on("disconnect", () => {
    console.log(
      "🔴 Socket disconnected:",
      socket.id
    );
  });
});

// =====================================================
// START SERVER
// =====================================================

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO running on port ${PORT}`);
});