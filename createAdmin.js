const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("./models/User");

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);

    const email = "admin@foodwaste.com";
    const password = "Admin@123456";

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name: "System Admin",
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin created successfully");
    console.log("Email:", admin.email);
    console.log("Password:", password);

    process.exit(0);
  } catch (error) {
    console.error("Admin creation error:", error.message);
    process.exit(1);
  }
};

createAdmin();