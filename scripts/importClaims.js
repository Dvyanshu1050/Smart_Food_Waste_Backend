const dns = require("dns");

// =====================================================
// DNS
// MongoDB SRV connection ke liye
// =====================================================

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const Claim = require("../models/Claim");
const Donation = require("../models/Donation");
const User = require("../models/User");

// =====================================================
// ENVIRONMENT
// =====================================================

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

// IMPORTANT:
// .env mein variable ka naam MONGO_URL hai.
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MONGO_URL not found in .env");
  process.exit(1);
}

// =====================================================
// EXCEL FILE
// =====================================================

const excelFile = path.join(
  __dirname,
  "../data/claims.xlsx"
);

// =====================================================
// STATUS MAPPING
// =====================================================

const statusMap = {
  Requested: "CLAIMED",
  Assigned: "ASSIGNED",
  "Picked Up": "PICKED_UP",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED",
};

// =====================================================
// DELIVERY STATUS MAPPING
// =====================================================

const deliveryStatusMap = {
  Requested: "Pending",
  Assigned: "Pending",
  "Picked Up": "Picked Up",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

// =====================================================
// NUMBER HELPER
// =====================================================

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

// =====================================================
// DATE HELPER
// =====================================================

const toDate = (value) => {
  if (!value) {
    return new Date();
  }

  // Excel serial date
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0
      );
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
};

// =====================================================
// CATEGORY HELPER
// =====================================================

const getCategory = (value) => {
  const category = String(value || "")
    .trim()
    .toLowerCase();

  const allowedCategories = [
    "cooked-meals",
    "grains",
    "vegetables",
    "fruits",
    "bakery",
    "packaged",
    "other",
  ];

  return allowedCategories.includes(category)
    ? category
    : "other";
};

// =====================================================
// 🟢 NEW: ROBUST GET VALUE HELPER (FUZZY MATCHER)
// =====================================================

const getValue = (row, targetKeys, fallback = "") => {
  // Target keys ko lowercase mein convert karein aur spaces/underscores hata dein
  const cleanTargets = targetKeys.map((k) =>
    String(k).toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  // Excel ki actual keys ko bhi same tarah se clean karke match karein
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");

    if (cleanTargets.includes(cleanKey)) {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return val;
      }
    }
  }

  return fallback;
};

// =====================================================
// MAIN IMPORT
// =====================================================

const importClaims = async () => {
  try {
    // =================================================
    // CONNECT MONGODB
    // =================================================

    console.log("🔄 Connecting to MongoDB...");

    await mongoose.connect(MONGO_URL);

    console.log("=================================");
    console.log("✅ MongoDB connected");
    console.log("=================================");

    // =================================================
    // CHECK EXCEL FILE
    // =================================================

    if (!fs.existsSync(excelFile)) {
      console.error("❌ claims.xlsx not found!");
      console.error("");
      console.error(
        `Expected location:\n${excelFile}`
      );

      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(
      `📁 Excel file found: ${excelFile}`
    );

    // =================================================
    // READ EXCEL
    // =================================================

    const workbook = XLSX.readFile(excelFile);

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      console.error("❌ No worksheet found.");

      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(
      `📄 Reading sheet: ${sheetName}`
    );

    const worksheet =
      workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
      }
    );

    console.log(
      `📊 Excel rows found: ${rows.length}`
    );

    if (rows.length === 0) {
      console.error(
        "❌ Excel file contains no data."
      );

      await mongoose.disconnect();
      process.exit(1);
    }

    // =================================================
    // SHOW HEADERS
    // =================================================

    console.log("");
    console.log("📋 Excel columns (First Row Keys):");

    console.log(
      Object.keys(rows[0])
    );

    console.log("");

    // =================================================
    // COUNTERS
    // =================================================

    let inserted = 0;
    let skipped = 0;
    let ngoCreated = 0;
    let donationCreated = 0;

    // =================================================
    // DEFAULT DONOR
    // =================================================

    let defaultDonor =
      await User.findOne({
        role: "donor",
      });

    if (!defaultDonor) {
      defaultDonor = await User.create({
        name: "Imported Donor",
        email:
          "imported-donor@foodbridge.local",
        password:
          "ImportedPassword123",
        role: "donor",
        isEmailVerified: true,
        verificationStatus: "VERIFIED",
        isBlocked: false,
        isActive: true,
      });

      console.log(
        "✅ Default donor created"
      );
    }

    // =================================================
    // PROCESS EACH ROW
    // =================================================

    for (const row of rows) {
      try {
        // =================================================
        // CLAIM ID
        // =================================================

        const claimId = String(
          getValue(
            row,
            [
              "Claim_ID",
              "Claim ID",
              "claimId",
            ],
            ""
          )
        ).trim();

        // =================================================
        // DONATION ID
        // =================================================

        const donationExternalId =
          String(
            getValue(
              row,
              [
                "Donation_ID",
                "Donation ID",
                "donationId",
              ],
              ""
            )
          ).trim();

        // =================================================
        // NGO ID
        // =================================================

        const ngoExternalId =
          String(
            getValue(
              row,
              [
                "NGO_ID",
                "NGO ID",
                "ngoId",
              ],
              ""
            )
          ).trim();

        // =================================================
        // REQUIRED DATA
        // =================================================

        if (
          !claimId ||
          !donationExternalId ||
          !ngoExternalId
        ) {
          console.log(
            "⚠️ Skipped row: Claim_ID / Donation_ID / NGO_ID missing"
          );

          skipped++;
          continue;
        }

        // =================================================
        // DUPLICATE CLAIM CHECK
        // =================================================

        const existingClaim =
          await Claim.findOne({
            claimId,
          });

        if (existingClaim) {
          console.log(
            `⏭️ Claim already exists: ${claimId}`
          );

          skipped++;
          continue;
        }

        // =================================================
        // FIND NGO
        // =================================================

        let ngo = null;

        // Agar NGO_ID actual MongoDB ObjectId hai
        if (
          mongoose.Types.ObjectId.isValid(
            ngoExternalId
          )
        ) {
          ngo = await User.findOne({
            _id: ngoExternalId,
            role: "ngo",
          });
        }

        // Agar external ID hai to email-based lookup
        if (!ngo) {
          const safeEmail =
            `${ngoExternalId
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")}@foodbridge.local`;

          ngo = await User.findOne({
            email: safeEmail,
            role: "ngo",
          });
        }

        // =================================================
        // CREATE NGO IF NOT FOUND
        // =================================================

        if (!ngo) {
          const safeEmail =
            `${ngoExternalId
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")}@foodbridge.local`;

          ngo = await User.create({
            name:
              `Imported NGO ${ngoExternalId}`,

            email: safeEmail,

            password:
              "ImportedPassword123",

            role: "ngo",

            isEmailVerified: true,

            verificationStatus:
              "VERIFIED",

            isBlocked: false,

            isActive: true,

            organizationName:
              `Imported NGO ${ngoExternalId}`,

            organizationDescription:
              "Imported from claims dataset.",
          });

          ngoCreated++;

          console.log(
            `🏢 NGO created: ${ngoExternalId}`
          );
        }

        // =================================================
        // FIND DONATION
        // =================================================

        let donation = null;

        // Agar Donation_ID actual MongoDB ObjectId hai
        if (
          mongoose.Types.ObjectId.isValid(
            donationExternalId
          )
        ) {
          donation =
            await Donation.findById(
              donationExternalId
            );
        }

        // =================================================
        // CLAIM DATA
        // =================================================

        const quantity = Math.max(
          toNumber(
            getValue(
              row,
              [
                "Claimed_Quantity_KG",
                "Claimed Quantity KG",
                "Quantity",
                "quantity",
              ],
              1
            ),
            1
          ),
          1
        );

        const claimDate = toDate(
          getValue(
            row,
            [
              "Claim_Date",
              "Claim Date",
              "claimedAt",
            ],
            ""
          )
        );

        const pickupDistance =
          Math.max(
            toNumber(
              getValue(
                row,
                [
                  "Pickup_Distance_KM",
                  "Pickup Distance KM",
                  "pickupDistanceKm",
                ],
                0
              ),
              0
            ),
            0
          );

        const pickupDelay =
          Math.max(
            toNumber(
              getValue(
                row,
                [
                  "Pickup_Delay_Min",
                  "Pickup Delay Min",
                  "pickupDelayMin",
                ],
                0
              ),
              0
            ),
            0
          );

        const excelDeliveryStatus =
          String(
            getValue(
              row,
              [
                "Delivery_Status",
                "Delivery Status",
                "deliveryStatus",
              ],
              "Requested"
            )
          ).trim();

        const claimStatus =
          statusMap[
            excelDeliveryStatus
          ] || "CLAIMED";

        const deliveryStatus =
          deliveryStatusMap[
            excelDeliveryStatus
          ] || "Pending";

        // =================================================
        // CREATE DONATION
        // =================================================

        if (!donation) {
          let donationStatus =
            "AVAILABLE";

          if (
            claimStatus === "CLAIMED" ||
            claimStatus === "ASSIGNED"
          ) {
            donationStatus =
              "CLAIMED";
          }

          if (
            claimStatus === "PICKED_UP"
          ) {
            donationStatus =
              "PICKED_UP";
          }

          if (
            claimStatus === "DELIVERED"
          ) {
            donationStatus =
              "DELIVERED";
          }

          const foodType =
            String(
              getValue(
                row,
                [
                  "Food_Type",
                  "Food Type",
                  "FoodType",
                  "foodType",
                ],
                "Imported Food"
              )
            ).trim();

          const category =
            getCategory(
              getValue(
                row,
                [
                  "Category",
                  "category",
                ],
                "other"
              )
            );

          const pickupLocation =
            String(
              getValue(
                row,
                [
                  "Pickup_Location",
                  "Pickup Location",
                  "PickupLocation",
                  "pickupLocation",
                ],
                "Imported Dataset Location"
              )
            ).trim();

          // Coordinates agar Excel mein available hain
          const latitude = toNumber(
            getValue(
              row,
              [
                "Latitude",
                "latitude",
              ],
              0
            ),
            0
          );

          const longitude = toNumber(
            getValue(
              row,
              [
                "Longitude",
                "longitude",
              ],
              0
            ),
            0
          );

          donation =
            await Donation.create({
              donor:
                defaultDonor._id,

              foodType:
                foodType ||
                "Imported Food",

              category,

              quantity,

              unit: "kg",

              pickupLocation:
                pickupLocation ||
                "Imported Dataset Location",

              latitude,

              longitude,

              pickupCoordinates: {
                type: "Point",
                coordinates: [
                  longitude,
                  latitude,
                ],
              },

              deliveryLocation:
                String(
                  getValue(
                    row,
                    [
                      "Delivery_Location",
                      "Delivery Location",
                    ],
                    ""
                  )
                ).trim(),

              deliveryLatitude:
                toNumber(
                  getValue(
                    row,
                    [
                      "Delivery_Latitude",
                      "Delivery Latitude",
                    ],
                    0
                  ),
                  0
                ),

              deliveryLongitude:
                toNumber(
                  getValue(
                    row,
                    [
                      "Delivery_Longitude",
                      "Delivery Longitude",
                    ],
                    0
                  ),
                  0
                ),

              pickupTime:
                claimDate,

              expiryTime:
                new Date(
                  claimDate.getTime() +
                    24 *
                      60 *
                      60 *
                      1000
                ),

              description:
                "Imported from claims dataset.",

              status:
                donationStatus,

              claimedBy:
                ngo._id,

              claimedAt:
                claimDate,

              pickedUpAt:
                claimStatus ===
                  "PICKED_UP" ||
                claimStatus ===
                  "DELIVERED"
                  ? claimDate
                  : null,

              deliveredAt:
                claimStatus ===
                "DELIVERED"
                  ? claimDate
                  : null,
            });

          donationCreated++;

          console.log(
            `🍱 Donation created: ${donationExternalId}`
          );
        }

        // =================================================
        // CREATE CLAIM
        // =================================================

        await Claim.create({
          claimId,

          donation:
            donation._id,

          ngo:
            ngo._id,

          volunteer: null,

          claimedQuantity:
            quantity,

          unit: "kg",

          claimedAt:
            claimDate,

          status:
            claimStatus,

          pickupDistanceKm:
            pickupDistance,

          pickupDelayMin:
            pickupDelay,

          deliveryStatus:
            deliveryStatus,

          pickedUpAt:
            claimStatus ===
              "PICKED_UP" ||
            claimStatus ===
              "DELIVERED"
              ? claimDate
              : null,

          deliveredAt:
            claimStatus ===
            "DELIVERED"
              ? claimDate
              : null,
        });

        inserted++;

        if (inserted % 50 === 0) {
          console.log(
            `✅ ${inserted} claims imported...`
          );
        }
      } catch (error) {
        console.error("");

        console.error(
          `❌ Error importing claim ${
            row.Claim_ID || "UNKNOWN"
          }:`
        );

        console.error(
          error.message
        );

        skipped++;
      }
    }

    // =================================================
    // FINAL REPORT
    // =================================================

    console.log("");
    console.log(
      "================================="
    );

    console.log(
      "🎉 IMPORT COMPLETE"
    );

    console.log(
      "================================="
    );

    console.log(
      `📄 Excel Rows        : ${rows.length}`
    );

    console.log(
      `✅ Claims Created    : ${inserted}`
    );

    console.log(
      `🏢 NGOs Created      : ${ngoCreated}`
    );

    console.log(
      `🍱 Donations Created : ${donationCreated}`
    );

    console.log(
      `⚠️ Skipped            : ${skipped}`
    );

    console.log(
      "================================="
    );

    console.log("");

    await mongoose.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("");
    console.error(
      "❌ IMPORT FAILED"
    );

    console.error(
      error.message
    );

    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(
        disconnectError.message
      );
    }

    process.exit(1);
  }
};

// =====================================================
// START
// =====================================================

importClaims();