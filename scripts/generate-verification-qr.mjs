import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const qrDir = join(publicDir, "qr");

const qrTargets = [
  {
    outputPath: join(publicDir, "verification-qr.png"),
    url: "https://ybit-certificate-verification.vercel.app",
  },
  {
    outputPath: join(qrDir, "youth-festival-2026-volunteer-ecertificates.png"),
    url: "https://ybit-certificate-verification.vercel.app/certificates/youth-festival-2026-volunteer-ecertificates",
  },
];

await mkdir(qrDir, { recursive: true });

for (const target of qrTargets) {
  await QRCode.toFile(target.outputPath, target.url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
    color: {
      dark: "#0b0b0b",
      light: "#ffffff",
    },
  });

  console.log(target.outputPath);
}
