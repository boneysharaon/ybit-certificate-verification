import Link from "next/link";
import { notFound } from "next/navigation";
import CertificateVerificationForm from "@/components/CertificateVerificationForm";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import { getCertificateEventBySlug } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventCertificatePageProps = {
  params: Promise<{
    eventSlug: string;
  }>;
};

export async function generateMetadata({ params }: EventCertificatePageProps) {
  const { eventSlug } = await params;
  const event = await getCertificateEventBySlug(eventSlug);

  if (!event) {
    return {
      title: "eCertificate Verification",
    };
  }

  return {
    title: `${event.pageTitle} | YBIT`,
  };
}

export default async function EventCertificatePage({
  params,
}: EventCertificatePageProps) {
  const { eventSlug } = await params;
  const event = await getCertificateEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  return (
    <main className="site-shell">
      <InstitutionalHeader />

      <section className="verification-intro" aria-labelledby="page-title">
        <p className="section-kicker">Official Verification Portal</p>
        <h1 id="page-title">{event.pageTitle}</h1>
        <p>{event.pageDescription}</p>
        <Link className="back-link" href="/">
          All eCertificate verification links
        </Link>
      </section>

      <CertificateVerificationForm event={event} />
    </main>
  );
}
