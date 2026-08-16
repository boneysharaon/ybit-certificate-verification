"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import InstitutionalHeader from "@/components/InstitutionalHeader";
import type { CertificateEvent } from "@/lib/certificateEvents";
import type { CertificateRecord } from "@/lib/types";

type VerificationCertificateProps = {
  certificate: CertificateRecord;
  event: CertificateEvent;
};

type SignatureImageProps = {
  src: string;
  alt: string;
};

function SignatureImage({ src, alt }: SignatureImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={280}
      height={118}
      className="signature-image"
      unoptimized
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function certificatePdfFileName(certificate: CertificateRecord) {
  const certificateId = sanitizeFileNamePart(certificate.letterId);
  const studentName = sanitizeFileNamePart(certificate.studentName);
  return `${certificateId}-${studentName}.pdf`;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function renderTemplateText(
  template: string,
  certificate: CertificateRecord,
  event: CertificateEvent,
) {
  const meritRank = certificate.meritRank || "the recorded";
  const meritCategory = certificate.meritCategory || event.eventName;
  const replacements: Record<string, ReactNode> = {
    certificateId: certificate.letterId,
    studentName: <strong>{certificate.studentName}</strong>,
    className: <strong>{certificate.className}</strong>,
    eventName: event.eventName,
    eventDate: event.eventDate,
    issueDate: event.issueDate,
    meritRank: <strong>{meritRank}</strong>,
    meritAwardTerm: event.meritAwardTerm,
    meritCategory: <strong>{meritCategory}</strong>,
  };

  return template
    .split(/(\{\{[a-zA-Z0-9_]+\}\})/g)
    .map((part, index) => {
      const key = part.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/)?.[1];

      if (!key) {
        return part;
      }

      return <span key={`${key}-${index}`}>{replacements[key] ?? part}</span>;
    });
}

export default function VerificationCertificate({
  certificate,
  event,
}: VerificationCertificateProps) {
  const certificateRef = useRef<HTMLElement>(null);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  const pdfFileName = certificatePdfFileName(certificate);

  function handlePrint() {
    const previousTitle = document.title;
    document.title = pdfFileName.replace(/\.pdf$/i, "");
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  async function handleSavePdf() {
    const certificateNode = certificateRef.current;
    if (!certificateNode || isSavingPdf) {
      return;
    }

    setIsSavingPdf(true);
    document.body.classList.add("pdf-export-mode");

    try {
      await document.fonts.ready;
      await waitForNextFrame();

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(certificateNode, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 2,
        useCORS: true,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageRatio = canvas.height / canvas.width;
      let imageWidth = pageWidth;
      let imageHeight = imageWidth * imageRatio;

      if (imageHeight > pageHeight) {
        imageHeight = pageHeight;
        imageWidth = imageHeight / imageRatio;
      }

      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = (pageHeight - imageHeight) / 2;
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        imageX,
        imageY,
        imageWidth,
        imageHeight,
      );
      pdf.save(pdfFileName);
    } finally {
      document.body.classList.remove("pdf-export-mode");
      setIsSavingPdf(false);
    }
  }

  return (
    <div className="certificate-output">
      <div className="certificate-actions no-print" aria-label="Certificate actions">
        <button type="button" className="secondary-action-button" onClick={handlePrint}>
          Print Certificate
        </button>
        <button
          type="button"
          className="secondary-action-button"
          disabled={isSavingPdf}
          onClick={handleSavePdf}
        >
          {isSavingPdf ? "Preparing PDF..." : "Save to PDF"}
        </button>
      </div>

      <article
        ref={certificateRef}
        className="verification-document"
        aria-labelledby="authentic-title"
      >
        <InstitutionalHeader />

        <div className="document-status document-status-valid online-only">
          <span aria-hidden="true" />
          <h2 id="authentic-title">THIS IS AN AUTHENTIC ECERTIFICATE</h2>
        </div>

        <div className="document-meta-grid" aria-label="Certificate details">
          <div>
            <span>Certificate ID</span>
            <strong>{certificate.letterId}</strong>
          </div>
          <div>
            <span>Student Name</span>
            <strong>{certificate.studentName}</strong>
          </div>
          <div>
            <span>Class</span>
            <strong>{certificate.className}</strong>
          </div>
          <div>
            <span>Event</span>
            <strong>{event.eventName}</strong>
          </div>
          {event.certificateType === "Merit" ? (
            <div>
              <span>Achievement</span>
              <strong>
                {certificate.meritRank || "Recorded"} {event.meritAwardTerm}
              </strong>
            </div>
          ) : null}
          <div>
            <span>Event Date</span>
            <strong>{event.eventDate}</strong>
          </div>
          <div>
            <span>Issue Date</span>
            <strong>{event.issueDate}</strong>
          </div>
        </div>

        <div className="letter-body">
          <p className="letter-title">{event.letterTitle}</p>
          <p className="concern-line">TO WHOMSOEVER IT MAY CONCERN</p>

          {event.letterBody.map((paragraph) => (
            <p key={paragraph}>
              {renderTemplateText(paragraph, certificate, event)}
            </p>
          ))}
        </div>

        <div className="certificate-verification-qr">
          <div className="qr-frame">
            <Image
              src={`/api/qr/${event.slug}`}
              alt={`QR code to open ${event.pageTitle}`}
              width={138}
              height={138}
              className="qr-code-image"
              unoptimized
            />
          </div>
          <div className="qr-instructions">
            <strong>Verify This Certificate</strong>
            <ol>
              {event.qrInstructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="signatory-row">
          {event.signatories.map((signatory, index) => (
            <div
              key={`${signatory.name}-${signatory.designation}`}
              className={index === 1 ? "signatory signatory-right" : "signatory"}
            >
              <SignatureImage
                src={signatory.signatureSrc}
                alt={signatory.signatureAlt}
              />
              <strong>{signatory.name}</strong>
              <span>{signatory.designation}</span>
            </div>
          ))}
        </div>

        <p className="verification-footnote">
          Scan the QR code or visit the official YBIT Certificate Verification
          Portal to verify this certificate.
        </p>
      </article>
    </div>
  );
}
