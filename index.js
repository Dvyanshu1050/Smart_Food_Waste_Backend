const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

require("dotenv").config();

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
// FRONTEND URLS
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://smart-food-waste-frontend.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log(
  "🌐 Allowed origins:",
  allowedOrigins
);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / server-to-server
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(
        "❌ CORS blocked:",
        origin
      );

      return callback(
        new Error(
          `CORS blocked for origin: ${origin}`
        )
      );
    },

    credentials: true,
  })
);

app.use(express.json());

// =====================================================
// ROUTES
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/donations",
  donationRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Smart Food Waste API is running",
  });
});

// =====================================================
// HTTP SERVER
// =====================================================

const PORT =
  process.env.PORT || 5000;

const server =
  http.createServer(app);

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests without origin
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(
        "❌ Socket.IO CORS blocked:",
        origin
      );

      return callback(
        new Error(
          `Socket.IO CORS blocked for origin: ${origin}`
        )
      );
    },

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

// =====================================================
// MAKE SOCKET.IO AVAILABLE TO CONTROLLERS
// =====================================================

app.set("io", io);

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", (socket) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "🟢 SOCKET CONNECTED"
  );
  console.log(
    "========================================"
  );
  console.log(
    "Socket ID:",
    socket.id
  );

  // ===================================================
  // WELCOME
  // ===================================================

  socket.emit("welcome", {
    message:
      "Connected to Smart Food Waste real-time server",
  });

  // ===================================================
  // DONOR WATCHES DONATION
  // ===================================================

  socket.on(
    "donation:tracking-watch",
    ({ donationId }) => {
      if (!donationId) {
        console.log(
          "⚠️ tracking-watch received without donationId",
          socket.id
        );

        return;
      }

      const room =
        `donation:${String(donationId)}`;

      socket.join(room);

      console.log("");
      console.log(
        "👀 DONOR WATCHING DONATION"
      );
      console.log(
        "Socket:",
        socket.id
      );
      console.log(
        "Donation:",
        donationId
      );
      console.log(
        "Room:",
        room
      );

      const members =
        io.sockets.adapter.rooms.get(
          room
        );

      console.log(
        "👥 Room members:",
        members
          ? Array.from(members)
          : []
      );

      // Confirm room join to donor
      socket.emit(
        "donation:tracking-watch-confirmed",
        {
          donationId,
          room,
        }
      );
    }
  );

  // ===================================================
  // START LIVE TRACKING
  // ===================================================

  socket.on(
    "donation:tracking-start",
    ({ donationId }) => {
      if (!donationId) {
        console.log(
          "⚠️ tracking-start received without donationId",
          socket.id
        );

        return;
      }

      const room =
        `donation:${String(donationId)}`;

      // NGO / volunteer joins same room
      socket.join(room);

      console.log("");
      console.log(
        "========================================"
      );
      console.log(
        "📍 LIVE TRACKING STARTED"
      );
      console.log(
        "========================================"
      );
      console.log(
        "NGO Socket:",
        socket.id
      );
      console.log(
        "Donation:",
        donationId
      );
      console.log(
        "Room:",
        room
      );

      const members =
        io.sockets.adapter.rooms.get(
          room
        );

      console.log(
        "👥 Room members:",
        members
          ? Array.from(members)
          : []
      );

      // Donor ko notify
      socket.to(room).emit(
        "donation:tracking-started",
        {
          donationId,
        }
      );

      console.log(
        "✅ tracking-started emitted"
      );
    }
  );

  // ===================================================
  // LIVE LOCATION UPDATE
  // ===================================================

  socket.on(
    "donation:location-update",
    ({
      donationId,
      latitude,
      longitude,
      accuracy,
    }) => {
      if (
        !donationId ||
        latitude === undefined ||
        longitude === undefined
      ) {
        console.log(
          "⚠️ Invalid location update:",
          {
            socketId: socket.id,
            donationId,
            latitude,
            longitude,
          }
        );

        return;
      }

      const lat =
        Number(latitude);

      const lng =
        Number(longitude);

      const gpsAccuracy =
        Number(accuracy) || 0;

      // Validate GPS
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        console.log(
          "⚠️ Invalid GPS coordinates:",
          {
            lat,
            lng,
          }
        );

        return;
      }

      const room =
        `donation:${String(donationId)}`;

      const members =
        io.sockets.adapter.rooms.get(
          room
        );

      console.log("");
      console.log(
        "📍 LIVE LOCATION UPDATE"
      );
      console.log(
        "Donation:",
        donationId
      );
      console.log(
        "NGO Socket:",
        socket.id
      );
      console.log(
        "Latitude:",
        lat
      );
      console.log(
        "Longitude:",
        lng
      );
      console.log(
        "Accuracy:",
        gpsAccuracy
      );
      console.log(
        "Room:",
        room
      );
      console.log(
        "👥 Room members:",
        members
          ? Array.from(members)
          : []
      );

      // Send to donor(s)
      socket.to(room).emit(
        "donation:location-updated",
        {
          donationId,
          latitude: lat,
          longitude: lng,
          accuracy: gpsAccuracy,
          timestamp: Date.now(),
        }
      );

      console.log(
        "✅ location-updated emitted to room"
      );
    }
  );

  // ===================================================
  // STOP LIVE TRACKING
  // ===================================================

  socket.on(
    "donation:tracking-stop",
    ({ donationId }) => {
      if (!donationId) {
        console.log(
          "⚠️ tracking-stop without donationId"
        );

        return;
      }

      const room =
        `donation:${String(donationId)}`;

      console.log("");
      console.log(
        "⛔ LIVE TRACKING STOPPED"
      );
      console.log(
        "Donation:",
        donationId
      );
      console.log(
        "Socket:",
        socket.id
      );
      console.log(
        "Room:",
        room
      );

      // Notify donor
      socket.to(room).emit(
        "donation:tracking-stopped",
        {
          donationId,
        }
      );

      // NGO leaves room
      socket.leave(room);

      console.log(
        `⛔ Socket ${socket.id} left ${room}`
      );
    }
  );

  // ===================================================
  // DISCONNECT
  // ===================================================

  socket.on(
    "disconnect",
    (reason) => {
      console.log("");
      console.log(
        "🔴 SOCKET DISCONNECTED"
      );
      console.log(
        "Socket:",
        socket.id
      );
      console.log(
        "Reason:",
        reason
      );
    }
  );
});

// =====================================================
// SERVER ERROR HANDLING
// =====================================================

server.on(
  "error",
  (error) => {
    console.error(
      "❌ Server error:",
      error
    );
  }
);

// =====================================================
// START SERVER
// =====================================================

server.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "🚀 SMART FOOD WASTE BACKEND"
    );
    console.log(
      "========================================"
    );

    console.log(
      `🚀 Server running on port ${PORT}`
    );

    console.log(
      `🔌 Socket.IO running on port ${PORT}`
    );

    console.log(
      "🌐 Allowed origins:",
      allowedOrigins
    );

    console.log(
      "========================================"
    );
  }
);