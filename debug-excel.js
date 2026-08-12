const XLSX = require("xlsx");
const path = require("path");

const excelFile = path.join(__dirname, "data/claims.xlsx"); // Path adjust karein agar zaroorat ho

try {
  const workbook = XLSX.readFile(excelFile);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  console.log("\n=============================================");
  console.log("🔍 EXCEL FILE DEBUGGER");
  console.log("=============================================\n");
  console.log("📊 Total Rows Found: ", rows.length);

  if (rows.length > 0) {
    console.log("\n📋 EXACT COLUMN HEADERS (Jo Code ko dikh rahe hain):");
    console.log(Object.keys(rows[0]));
    console.log("\n📝 FIRST ROW DATA:");
    console.log(rows[0]);
  } else {
    console.log("❌ File khali hai.");
  }
} catch (error) {
  console.log("❌ Error reading file: ", error.message);
}