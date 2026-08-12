const dns = require("dns");

// DNS workaround for MongoDB SRV
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const User = require("../models/User");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MONGO_URL not found in .env");
  process.exit(1);
}

// ⚠️ Ensure correct file path (ajust if needed)
const excelFile = path.join(__dirname, "../data/claims.xlsx");

const importDonors = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URL);
    console.log("✅ MongoDB connected");

    if (!fs.existsSync(excelFile)) {
      console.error(`❌ Excel file not found at: ${excelFile}`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log(`📊 Found ${rows.length} rows in Excel.`);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const donorId = String(row["Donor_ID"]).trim();
        const donorName = String(row["Donor_Name"]).trim();
        
        if (!donorId || !donorName) {
          skipped++;
          continue;
        }

        // Generate a safe email for the imported donor
        const email = `${donorId.toLowerCase()}@foodbridge.local`;

        // Check for duplicate
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
          skipped++;
          continue;
        }

        // Create new Donor
        await User.create({
          name: donorName,
          email: email,
          password: "ImportedPassword123", // Default password
          role: "donor",
          isEmailVerified: true,
          verificationStatus: "VERIFIED",
          isBlocked: String(row["Active"]).toLowerCase() === "no",
          isActive: String(row["Active"]).toLowerCase() === "yes",
          
          // Saving extra Excel data into address or organization description if needed
          address: `${row["Area"]}, ${row["City"]}`,
          organizationType: row["Donor_Type"]
        });

        inserted++;

        if (inserted % 1000 === 0) {
          console.log(`✅ ${inserted} donors imported...`);
        }
      } catch (error) {
        console.error(`❌ Error inserting row: ${error.message}`);
        skipped++;
      }
    }

    console.log("\n=================================");
    console.log("🎉 DONOR IMPORT COMPLETE");
    console.log("=================================");
    console.log(`📄 Total Rows  : ${rows.length}`);
    console.log(`✅ Inserted    : ${inserted}`);
    console.log(`⚠️ Skipped     : ${skipped}`);
    console.log("=================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ IMPORT FAILED", error);
    process.exit(1);
  }
};

importDonors();