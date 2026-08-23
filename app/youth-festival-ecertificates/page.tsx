import type { Metadata } from "next";
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
        <p>{downloads.length} individual eCertificates are available below.</p>
      </section>

      <ol className="download-directory" aria-label="Youth Festival 2026 eCertificate downloads">
        {downloads.map((certificate, index) => (
          <li key={certificate.certificateId}>
            <a className="download-link" href={certificate.href} download>
              <span className="download-index">{String(index + 1).padStart(3, "0")}</span>
              <span className="download-copy">
                <strong>{certificate.studentName}</strong>
                <small>{certificate.certificateId}</small>
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
