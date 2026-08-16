import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".vercel",
  "coverage",
  "node_modules",
]);
const ignoredFiles = new Set(["package-lock.json", "check-forbidden-features.mjs"]);
const textExtensions = new Set([
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const forbiddenPattern =
  /(-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----|GOOGLE_PRIVATE_KEY\s*=|password\s*=)/i;
const allowedPlaceholderPattern = /YOUR_PRIVATE_KEY_CONTENT/i;

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = join(dir, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      return ignoredDirectories.has(entry) ? [] : collectFiles(absolutePath);
    }

    if (ignoredFiles.has(basename(absolutePath))) {
      return [];
    }

    return textExtensions.has(extname(absolutePath).toLowerCase()) ? [absolutePath] : [];
  });
}

if (!existsSync(root)) {
  throw new Error("Project root was not found.");
}

const matches = collectFiles(root).flatMap((file) => {
  const contents = readFileSync(file, "utf8");
  return contents
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(
      ({ line }) =>
        forbiddenPattern.test(line) && !allowedPlaceholderPattern.test(line),
    )
    .map(({ line, index }) => `${relative(root, file)}:${index}: ${line.trim()}`);
});

if (matches.length > 0) {
  throw new Error(`Forbidden source text was found:\n${matches.join("\n")}`);
}

console.log("No forbidden source text found.");
