import Link from "next/link";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import { getCertificateEvents } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const certificateEvents = await getCertificateEvents();

  return (
    <main className="site-shell">
      <InstitutionalHeader />

      <section className="verification-intro" aria-labelledby="page-title">
        <p className="section-kicker">Official Verification Portal</p>
        <h1 id="page-title">Certificate Verification</h1>
        <p>
          Choose the eCertificate category printed on your document to continue
          verification.
        </p>
      </section>

      <nav className="certificate-directory" aria-label="eCertificate categories">
        {certificateEvents.map((event) => (
          <Link
            key={event.slug}
            className="certificate-directory-link"
            href={`/certificates/${event.slug}`}
          >
            <span>{event.homeLinkLabel}</span>
            <small>
              Certificate ID format: {event.certificateIdPrefix}
              {event.certificateIdExample}
            </small>
          </Link>
        ))}
      </nav>
    </main>
  );
}
