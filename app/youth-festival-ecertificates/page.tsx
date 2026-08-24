import type { Metadata } from "next";
import Link from "next/link";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import downloads from "@/lib/youthFestivalDownloads.json";

export const metadata: Metadata = {
  title: "Youth Festival 2026 eCertificate Downloads | YBIT",
  robots: {
    index: false,
    follow: false,
  },
};

export default function YouthFestivalDownloadsPage() {
  return (
    <main className="site-shell">
      <InstitutionalHeader />

      <section className="verification-intro download-intro" aria-labelledby="page-title">
        <p className="section-kicker">Youth Festival 2026</p>
        <h1 id="page-title">Volunteer eCertificate Downloads</h1>
        <Link
          className="download-verify-link"
          href="/certificates/youth-festival-2026-volunteer-ecertificates"
        >
          Verify here
        </Link>
        <p className="download-cooldown-note">
          After downloading one eCertificate, please wait 10 minutes before downloading another.
        </p>
      </section>

      <ol className="download-directory" aria-label="Youth Festival 2026 eCertificate downloads">
        {downloads.map((certificate, index) => (
          <li key={certificate.downloadId}>
            <a className="download-link" href={certificate.href}>
              <span className="download-index">{String(index + 1).padStart(3, "0")}</span>
              <span className="download-copy">
                <strong>{certificate.studentName}</strong>
              </span>
              <span className="download-format" aria-label="Download PDF">
                PDF
              </span>
            </a>
          </li>
        ))}
      </ol>
    </main>
  );
}
