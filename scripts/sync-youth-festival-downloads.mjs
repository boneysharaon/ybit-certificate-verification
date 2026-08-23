import { copyFile, mkdir, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceDir = path.join(
  workspaceRoot,
  "youth-festival-certificates-all-142-compact",
);
const privateSubDir = path.join(
  "ecertificates",
  "youth-festival-2026",
);
const certificateDir = path.join(projectRoot, "private", privateSubDir);
const indexPath = path.join(projectRoot, "lib", "youthFestivalDownloads.json");
const filePattern = /^YBIT-CulturalDept-YF-V-([A-Z0-9]+)-(.+)\.pdf$/;

function makeCertificateId(idPart) {
  return `YBIT/CulturalDept/YF/V/${idPart}`;
}

function makeHref(fileName) {
  return `/api/download/youth-festival-2026/${encodeURIComponent(fileName)}`;
}

const files = (await readdir(sourceDir))
  .filter((fileName) => fileName.toLowerCase().endsWith(".pdf"))
  .sort((left, right) => left.localeCompare(right));

const downloads = [];
await mkdir(certificateDir, { recursive: true });

for (const fileName of files) {
  const match = fileName.match(filePattern);

  if (!match) {
    throw new Error(`Unexpected certificate PDF filename: ${fileName}`);
  }

  const [, idPart, studentName] = match;
  await copyFile(path.join(sourceDir, fileName), path.join(certificateDir, fileName));
  downloads.push({
    studentName,
    certificateId: makeCertificateId(idPart),
    fileName,
    href: makeHref(fileName),
  });
}

downloads.sort((left, right) =>
  left.studentName.localeCompare(right.studentName, "en-IN", {
    sensitivity: "base",
  }),
);

await writeFile(`${indexPath}.tmp`, `${JSON.stringify(downloads, null, 2)}\n`);
await rename(`${indexPath}.tmp`, indexPath);

console.log(`Synced ${downloads.length} certificate downloads.`);
