import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const staticDir = join(process.cwd(), ".next", "static");
const confidentialMarkers = [
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_TAB_NAME",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "oauth2.googleapis.com/token",
  "sheets.googleapis.com",
];

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = join(dir, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return collectFiles(absolutePath);
    }

    return [absolutePath];
  });
}

if (!existsSync(staticDir)) {
  throw new Error("Client bundle directory was not found. Run the production build first.");
}

const matches = collectFiles(staticDir).filter((file) => {
  const contents = readFileSync(file, "utf8");
  return confidentialMarkers.some((marker) => contents.includes(marker));
});

if (matches.length > 0) {
  throw new Error(
    `Confidential server-only marker found in client bundle: ${matches.join(", ")}`,
  );
}

console.log("Client bundle check passed.");
